import cvModule from '@techstark/opencv-js'

let cvPromise

export function getOpenCv() {
  if (!cvPromise) {
    cvPromise = (async () => {
      // @techstark/opencv-js exports either the initialized module, a real Promise,
      // or an Emscripten module that signals readiness with onRuntimeInitialized.
      // Do not probe/await arbitrary ".then" properties: some bundled Emscripten
      // objects expose Promise.prototype.then without being valid Promise receivers.
      if (cvModule instanceof Promise) return await cvModule
      if (cvModule?.Mat) return cvModule

      await new Promise((resolve) => {
        const previous = cvModule.onRuntimeInitialized
        cvModule.onRuntimeInitialized = () => {
          if (typeof previous === 'function') previous()
          resolve()
        }
      })

      return cvModule
    })()
  }
  return cvPromise
}

export function extractOrbFeatures(cv, imageData, maxFeatures = 1400) {
  const source = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const mask = new cv.Mat()
  const keypoints = new cv.KeyPointVector()
  const descriptors = new cv.Mat()
  const orb = new cv.ORB()

  try {
    if (typeof orb.setMaxFeatures === 'function') orb.setMaxFeatures(maxFeatures)
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY, 0)
    orb.detectAndCompute(gray, mask, keypoints, descriptors)

    const points = []
    for (let i = 0; i < keypoints.size(); i += 1) {
      const keypoint = keypoints.get(i)
      points.push([keypoint.pt.x, keypoint.pt.y])
    }

    return { points, descriptors }
  } finally {
    source.delete()
    gray.delete()
    mask.delete()
    keypoints.delete()
    orb.delete()
  }
}

export function matchOrbFeatures(cv, left, right, ratioThreshold = 0.76) {
  if (!left.descriptors?.rows || !right.descriptors?.rows) return []

  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false)
  const matches = new cv.DMatchVectorVector()
  const good = []

  try {
    matcher.knnMatch(left.descriptors, right.descriptors, matches, 2)

    for (let i = 0; i < matches.size(); i += 1) {
      const pair = matches.get(i)
      try {
        if (pair.size() < 2) continue
        const first = pair.get(0)
        const second = pair.get(1)
        if (first.distance < ratioThreshold * second.distance) {
          good.push({
            queryIndex: first.queryIdx,
            trainIndex: first.trainIdx,
            distance: first.distance,
          })
        }
      } finally {
        pair.delete()
      }
    }
  } finally {
    matches.delete()
    matcher.delete()
  }

  return good
}
