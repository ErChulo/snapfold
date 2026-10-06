import { analyzePhoto, normalizePixel } from './photoAnalysis.js'
import { extractOrbFeatures, getOpenCv, matchOrbFeatures } from './opencv.js'
import {
  cameraCenterAndForward,
  cameraPointToWorld,
  composeWorldToCamera,
  estimateEssentialRansac,
  recoverRelativePose,
  triangulateNormalized,
} from './linearAlgebra.js'

const identityPose = {
  rotation: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  translation: [0, 0, 0],
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function correspondenceSet(matches, anchor, target) {
  return matches.map((match) => ({
    match,
    p1: normalizePixel(anchor.points[match.queryIndex], anchor.intrinsics),
    p2: normalizePixel(target.points[match.trainIndex], target.intrinsics),
  }))
}

function finiteReasonablePoint(point) {
  return (
    point
    && point.every(Number.isFinite)
    && point[2] > 0.02
    && Math.abs(point[0]) < 100
    && Math.abs(point[1]) < 100
    && point[2] < 120
  )
}

function poseForResult(pose, registered = true) {
  if (!pose) return { registered: false }
  const { center, forward } = cameraCenterAndForward(pose)
  return {
    registered,
    rotation: pose.rotation,
    translation: pose.translation,
    center,
    forward,
  }
}

export async function runSparseReconstruction(photos, {
  materialProfile,
  maxDimension = 1024,
  maxFeatures = 1400,
  minMatches = 22,
  minInliers = 14,
  anchorLookback = 3,
  onProgress = () => {},
} = {}) {
  if (photos.length < 2) throw new Error('At least two overlapping photos are required for sparse reconstruction.')

  onProgress({ stage: 'engine', current: 0, total: 1, message: 'Loading local OpenCV/WASM engine…' })
  const cv = await getOpenCv()
  onProgress({ stage: 'engine', current: 1, total: 1, message: 'Computer-vision engine ready.' })

  const frames = []
  const descriptorsToDelete = []

  try {
    for (let i = 0; i < photos.length; i += 1) {
      onProgress({
        stage: 'features',
        current: i,
        total: photos.length,
        message: `Analyzing photo ${i + 1} of ${photos.length}: ${photos[i].name}`,
      })

      const analyzed = await analyzePhoto(photos[i], { maxDimension })
      const features = extractOrbFeatures(cv, analyzed.imageData, maxFeatures)
      descriptorsToDelete.push(features.descriptors)
      frames.push({
        ...analyzed,
        imageData: undefined,
        points: features.points,
        descriptors: features.descriptors,
      })
      await nextFrame()
    }

    onProgress({
      stage: 'features',
      current: photos.length,
      total: photos.length,
      message: 'Feature extraction complete.',
    })

    const poses = Array.from({ length: frames.length }, () => null)
    poses[0] = identityPose
    const cloud = []
    const pairDiagnostics = []
    let totalRawMatches = 0
    let totalInliers = 0

    for (let targetIndex = 1; targetIndex < frames.length; targetIndex += 1) {
      onProgress({
        stage: 'registration',
        current: targetIndex - 1,
        total: frames.length - 1,
        message: `Registering camera ${targetIndex + 1} of ${frames.length}…`,
      })

      let bestCandidate = null
      const firstAnchor = Math.max(0, targetIndex - anchorLookback)

      for (let anchorIndex = targetIndex - 1; anchorIndex >= firstAnchor; anchorIndex -= 1) {
        if (!poses[anchorIndex]) continue

        const matches = matchOrbFeatures(cv, frames[anchorIndex], frames[targetIndex])
        totalRawMatches += matches.length
        if (matches.length < minMatches) continue

        const correspondences = correspondenceSet(matches, frames[anchorIndex], frames[targetIndex])
        const meanFocal = (
          frames[anchorIndex].intrinsics.fx + frames[targetIndex].intrinsics.fx
        ) / 2
        const threshold = Math.max(0.0008, 2.2 / meanFocal)
        const geometry = estimateEssentialRansac(correspondences, {
          threshold,
          maxIterations: 320,
          seed: 0x51f15e + anchorIndex * 65537 + targetIndex * 257,
        })
        if (!geometry || geometry.inlierIndices.length < minInliers) continue

        const pose = recoverRelativePose(geometry.E, correspondences, geometry.inlierIndices)
        if (!pose || pose.positiveDepth < Math.max(8, Math.floor(geometry.inlierIndices.length * 0.45))) continue

        const candidate = {
          anchorIndex,
          targetIndex,
          matches,
          correspondences,
          geometry,
          relativePose: pose,
          score: geometry.inlierIndices.length,
        }
        if (!bestCandidate || candidate.score > bestCandidate.score) bestCandidate = candidate
      }

      if (!bestCandidate) {
        pairDiagnostics.push({
          targetIndex,
          registered: false,
          message: 'No geometrically stable overlap found with nearby registered views.',
        })
        await nextFrame()
        continue
      }

      const {
        anchorIndex,
        correspondences,
        geometry,
        relativePose,
        matches,
      } = bestCandidate

      const baselineScale = Math.max(1, targetIndex - anchorIndex)
      const targetPose = composeWorldToCamera(
        poses[anchorIndex],
        relativePose.R,
        relativePose.t,
        baselineScale,
      )
      poses[targetIndex] = targetPose
      totalInliers += geometry.inlierIndices.length

      let acceptedPoints = 0
      const cappedInliers = geometry.inlierIndices.slice(0, 420)
      for (const index of cappedInliers) {
        const correspondence = correspondences[index]
        const cameraPoint = triangulateNormalized(
          correspondence.p1,
          correspondence.p2,
          relativePose.R,
          relativePose.t.map((value) => value * baselineScale),
        )
        if (!finiteReasonablePoint(cameraPoint)) continue
        cloud.push(cameraPointToWorld(cameraPoint, poses[anchorIndex]))
        acceptedPoints += 1
      }

      pairDiagnostics.push({
        anchorIndex,
        targetIndex,
        registered: true,
        rawMatches: matches.length,
        inliers: geometry.inlierIndices.length,
        triangulated: acceptedPoints,
      })
      await nextFrame()
    }

    onProgress({
      stage: 'registration',
      current: frames.length - 1,
      total: frames.length - 1,
      message: 'Sparse registration complete.',
    })

    const cameras = poses.map((pose, index) => ({
      index,
      name: frames[index].name,
      featureCount: frames[index].points.length,
      intrinsics: frames[index].intrinsics,
      ...poseForResult(pose),
    }))

    return {
      version: '0.2.0-alpha.1',
      materialProfile,
      createdAt: new Date().toISOString(),
      photosAnalyzed: frames.length,
      totalFeatures: frames.reduce((sum, frame) => sum + frame.points.length, 0),
      totalRawMatches,
      totalInliers,
      registeredCameras: cameras.filter((camera) => camera.registered).length,
      failedCameras: cameras.filter((camera) => !camera.registered).length,
      pointCount: cloud.length,
      points: cloud,
      cameras,
      pairs: pairDiagnostics,
      intrinsicSources: Array.from(new Set(frames.map((frame) => frame.intrinsics.source))),
      scaleNote: 'Monocular sparse reconstruction has arbitrary global scale; camera baselines are normalized for diagnostics.',
    }
  } finally {
    for (const descriptors of descriptorsToDelete) descriptors.delete()
  }
}
