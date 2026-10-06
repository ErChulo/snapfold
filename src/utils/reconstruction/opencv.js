let cvPromise

export async function getOpenCv() {
  if (!cvPromise) {
    cvPromise = import('@techstark/opencv-js').then(async (module) => {
      const candidate = module.default ?? module
      const cv = typeof candidate?.then === 'function' ? await candidate : candidate
      if (cv?.Mat) return cv

      await new Promise((resolve) => {
        const previous = cv.onRuntimeInitialized
        cv.onRuntimeInitialized = () => {
          if (typeof previous === 'function') previous()
          resolve()
        }
      })
      return cv
    })
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
    orb.setMaxFeatures(maxFeatures)
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
