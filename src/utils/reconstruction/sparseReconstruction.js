import { analyzePhoto, normalizePixel } from './photoAnalysis.js'
import { extractOrbFeatures, getOpenCv, matchOrbFeatures } from './opencv.js'
import {
  cameraCenterAndForward,
  cameraPointToWorld,
  composeWorldToCamera,
  estimateEssentialRansac,
  invertRelativePose,
  recoverRelativePose,
  relativeRotationAngle,
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
    && Math.abs(point[0]) < 150
    && Math.abs(point[1]) < 150
    && point[2] < 180
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

function makePairPlan(count) {
  const keys = new Set()
  const pairs = []

  const add = (a, b) => {
    if (a === b) return
    const i = Math.min(a, b)
    const j = Math.max(a, b)
    if (i < 0 || j >= count) return
    const key = `${i}:${j}`
    if (keys.has(key)) return
    keys.add(key)
    pairs.push([i, j])
  }

  if (count <= 24) {
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) add(i, j)
    }
    return pairs
  }

  // Larger jobs use a dense local window plus cyclic closure and approximate
  // cross-ring links. This avoids O(n^2) browser work for 30–50 images.
  const window = 8
  for (let i = 0; i < count; i += 1) {
    for (let delta = 1; delta <= window; delta += 1) {
      add(i, i + delta)
      add(i, (i + delta) % count)
    }
  }

  const ring = Math.max(2, Math.round(count / 3))
  for (let i = 0; i < count; i += 1) {
    add(i, i + ring)
    add(i, i + 2 * ring)
  }

  return pairs
}

function graphComponents(nodeCount, edges) {
  const adjacency = Array.from({ length: nodeCount }, () => [])
  for (const edge of edges) {
    adjacency[edge.a].push(edge)
    adjacency[edge.b].push(edge)
  }

  const visited = new Set()
  const components = []

  for (let node = 0; node < nodeCount; node += 1) {
    if (visited.has(node) || adjacency[node].length === 0) continue
    const queue = [node]
    const nodes = []
    const componentEdges = new Set()
    visited.add(node)

    while (queue.length) {
      const current = queue.shift()
      nodes.push(current)
      for (const edge of adjacency[current]) {
        componentEdges.add(edge)
        const next = edge.a === current ? edge.b : edge.a
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }

    const edgesArray = Array.from(componentEdges)
    components.push({
      nodes,
      edges: edgesArray,
      score: edgesArray.reduce((sum, edge) => sum + edge.score, 0),
    })
  }

  return components.sort((left, right) => (
    right.nodes.length - left.nodes.length || right.score - left.score
  ))
}

function orientedEdge(edge, anchorIndex) {
  if (edge.a === anchorIndex) {
    return {
      anchorIndex: edge.a,
      targetIndex: edge.b,
      R: edge.relativePose.R,
      t: edge.relativePose.t,
    }
  }

  const inverse = invertRelativePose(edge.relativePose.R, edge.relativePose.t)
  return {
    anchorIndex: edge.b,
    targetIndex: edge.a,
    R: inverse.R,
    t: inverse.t,
  }
}

function baselineScaleForEdge(edge, medianAngle) {
  const angle = Math.max(0.02, relativeRotationAngle(edge.relativePose.R))
  const reference = Math.max(0.04, medianAngle || angle)
  return Math.max(0.45, Math.min(2.2, angle / reference))
}

export async function runSparseReconstruction(photos, {
  materialProfile,
  maxDimension = 1024,
  maxFeatures = 1800,
  minMatches = 14,
  minInliers = 10,
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

    const pairPlan = makePairPlan(frames.length)
    const acceptedEdges = []
    let totalRawMatches = 0
    let totalInliers = 0

    for (let pairIndex = 0; pairIndex < pairPlan.length; pairIndex += 1) {
      const [a, b] = pairPlan[pairIndex]
      onProgress({
        stage: 'overlap',
        current: pairIndex,
        total: pairPlan.length,
        message: `Discovering overlap ${pairIndex + 1} of ${pairPlan.length}: ${a + 1} ↔ ${b + 1}`,
      })

      const matches = matchOrbFeatures(cv, frames[a], frames[b], 0.82)
      totalRawMatches += matches.length
      if (matches.length >= minMatches) {
        const correspondences = correspondenceSet(matches, frames[a], frames[b])
        const meanFocal = (frames[a].intrinsics.fx + frames[b].intrinsics.fx) / 2
        const threshold = Math.max(0.0012, 3.0 / meanFocal)
        const geometry = estimateEssentialRansac(correspondences, {
          threshold,
          maxIterations: 520,
          seed: 0x51f15e + a * 65537 + b * 257,
        })

        if (geometry) {
          const inliers = geometry.inlierIndices.length
          const ratio = inliers / matches.length

          if (inliers >= minInliers && ratio >= 0.16) {
            const relativePose = recoverRelativePose(geometry.E, correspondences, geometry.inlierIndices)
            const positiveRequired = Math.max(6, Math.floor(inliers * 0.28))

            if (relativePose && relativePose.positiveDepth >= positiveRequired) {
              totalInliers += inliers
              acceptedEdges.push({
                a,
                b,
                matches,
                correspondences,
                geometry,
                relativePose,
                inliers,
                inlierRatio: ratio,
                score: inliers * (0.65 + ratio),
              })
            }
          }
        }
      }

      if (pairIndex % 3 === 0) await nextFrame()
    }

    const components = graphComponents(frames.length, acceptedEdges)
    const mainComponent = components[0] || null
    const poses = Array.from({ length: frames.length }, () => null)
    const treeEdges = []
    const cloud = []

    if (mainComponent?.edges.length) {
      const seed = [...mainComponent.edges].sort((left, right) => right.score - left.score)[0]
      poses[seed.a] = identityPose

      const seedScale = 1
      poses[seed.b] = composeWorldToCamera(
        poses[seed.a],
        seed.relativePose.R,
        seed.relativePose.t,
        seedScale,
      )
      treeEdges.push({ edge: seed, anchorIndex: seed.a, targetIndex: seed.b, baselineScale: seedScale })

      const registered = new Set([seed.a, seed.b])
      const angles = mainComponent.edges
        .map((edge) => relativeRotationAngle(edge.relativePose.R))
        .filter((value) => Number.isFinite(value) && value > 0.01)
        .sort((a, b) => a - b)
      const medianAngle = angles.length ? angles[Math.floor(angles.length / 2)] : 0.15

      while (registered.size < mainComponent.nodes.length) {
        let best = null

        for (const edge of mainComponent.edges) {
          const aRegistered = registered.has(edge.a)
          const bRegistered = registered.has(edge.b)
          if (aRegistered === bRegistered) continue
          if (!best || edge.score > best.score) best = edge
        }

        if (!best) break

        const anchorIndex = registered.has(best.a) ? best.a : best.b
        const oriented = orientedEdge(best, anchorIndex)
        const baselineScale = baselineScaleForEdge(best, medianAngle)
        poses[oriented.targetIndex] = composeWorldToCamera(
          poses[oriented.anchorIndex],
          oriented.R,
          oriented.t,
          baselineScale,
        )
        registered.add(oriented.targetIndex)
        treeEdges.push({
          edge: best,
          anchorIndex: oriented.anchorIndex,
          targetIndex: oriented.targetIndex,
          baselineScale,
        })
      }

      for (let treeIndex = 0; treeIndex < treeEdges.length; treeIndex += 1) {
        const item = treeEdges[treeIndex]
        const edge = item.edge

        onProgress({
          stage: 'triangulation',
          current: treeIndex,
          total: treeEdges.length,
          message: `Triangulating verified overlap ${treeIndex + 1} of ${treeEdges.length}…`,
        })

        const forward = edge.a === item.anchorIndex
        const R = forward ? edge.relativePose.R : invertRelativePose(edge.relativePose.R, edge.relativePose.t).R
        const t0 = forward ? edge.relativePose.t : invertRelativePose(edge.relativePose.R, edge.relativePose.t).t
        const t = t0.map((value) => value * item.baselineScale)

        const cappedInliers = edge.geometry.inlierIndices.slice(0, 520)
        for (const index of cappedInliers) {
          const original = edge.correspondences[index]
          const p1 = forward ? original.p1 : original.p2
          const p2 = forward ? original.p2 : original.p1
          const cameraPoint = triangulateNormalized(p1, p2, R, t)
          if (!finiteReasonablePoint(cameraPoint)) continue
          cloud.push(cameraPointToWorld(cameraPoint, poses[item.anchorIndex]))
        }

        await nextFrame()
      }
    } else {
      // Keep one reference camera visible in diagnostics even when no pair survives.
      const bestFeatureIndex = frames.reduce((best, frame, index) => (
        frame.points.length > frames[best].points.length ? index : best
      ), 0)
      poses[bestFeatureIndex] = identityPose
    }

    const cameras = poses.map((pose, index) => ({
      index,
      name: frames[index].name,
      featureCount: frames[index].points.length,
      intrinsics: frames[index].intrinsics,
      ...poseForResult(pose),
    }))

    const registeredCount = cameras.filter((camera) => camera.registered).length
    const failedNames = cameras.filter((camera) => !camera.registered).map((camera) => camera.name)

    onProgress({
      stage: 'complete',
      current: 1,
      total: 1,
      message: 'Overlap-graph reconstruction complete.',
    })

    return {
      version: '0.2.0-alpha.3',
      materialProfile,
      createdAt: new Date().toISOString(),
      photosAnalyzed: frames.length,
      totalFeatures: frames.reduce((sum, frame) => sum + frame.points.length, 0),
      totalRawMatches,
      totalInliers,
      overlapPairsTested: pairPlan.length,
      acceptedPairEdges: acceptedEdges.length,
      connectedComponents: components.length,
      mainComponentSize: mainComponent?.nodes.length || 1,
      registrationTreeEdges: treeEdges.length,
      registeredCameras: registeredCount,
      failedCameras: frames.length - registeredCount,
      failedNames,
      pointCount: cloud.length,
      points: cloud,
      cameras,
      pairs: acceptedEdges.map((edge) => ({
        a: edge.a,
        b: edge.b,
        rawMatches: edge.matches.length,
        inliers: edge.inliers,
        inlierRatio: edge.inlierRatio,
      })),
      intrinsicSources: Array.from(new Set(frames.map((frame) => frame.intrinsics.source))),
      scaleNote: 'Monocular sparse reconstruction has arbitrary global scale. Alpha.3 uses relative-rotation-scaled tree baselines for a coherent diagnostic view; metric scale still requires a known dimension.',
    }
  } finally {
    for (const descriptors of descriptorsToDelete) descriptors.delete()
  }
}
