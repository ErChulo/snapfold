import { EigenvalueDecomposition, Matrix, SingularValueDecomposition } from 'ml-matrix'

const W = new Matrix([
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
])

function det3(m) {
  return (
    m.get(0, 0) * (m.get(1, 1) * m.get(2, 2) - m.get(1, 2) * m.get(2, 1))
    - m.get(0, 1) * (m.get(1, 0) * m.get(2, 2) - m.get(1, 2) * m.get(2, 0))
    + m.get(0, 2) * (m.get(1, 0) * m.get(2, 1) - m.get(1, 1) * m.get(2, 0))
  )
}

function scaleColumn(matrix, column, factor) {
  for (let row = 0; row < matrix.rows; row += 1) {
    matrix.set(row, column, matrix.get(row, column) * factor)
  }
}

function nullVector(matrix) {
  const normal = matrix.transpose().mmul(matrix)
  const evd = new EigenvalueDecomposition(normal, { assumeSymmetric: true })
  const values = evd.realEigenvalues
  let index = 0
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[index]) index = i
  }
  return evd.eigenvectorMatrix.getColumn(index)
}

function reshapeEssential(values) {
  return new Matrix([
    [values[0], values[1], values[2]],
    [values[3], values[4], values[5]],
    [values[6], values[7], values[8]],
  ])
}

function enforceEssentialConstraints(E) {
  const svd = new SingularValueDecomposition(E)
  const U = svd.leftSingularVectors.clone()
  const V = svd.rightSingularVectors.clone()

  if (det3(U) < 0) scaleColumn(U, 2, -1)
  if (det3(V) < 0) scaleColumn(V, 2, -1)

  const s = Math.max(1e-12, (svd.diagonal[0] + svd.diagonal[1]) / 2)
  return U.mmul(Matrix.diag([s, s, 0])).mmul(V.transpose())
}

function eightPointEssential(correspondences) {
  if (correspondences.length < 8) return null
  const A = new Matrix(correspondences.map(({ p1, p2 }) => {
    const [x1, y1] = p1
    const [x2, y2] = p2
    return [
      x2 * x1, x2 * y1, x2,
      y2 * x1, y2 * y1, y2,
      x1, y1, 1,
    ]
  }))
  return enforceEssentialConstraints(reshapeEssential(nullVector(A)))
}

function sampsonError(E, { p1, p2 }) {
  const [x1, y1] = p1
  const [x2, y2] = p2

  const ex1 = [
    E.get(0, 0) * x1 + E.get(0, 1) * y1 + E.get(0, 2),
    E.get(1, 0) * x1 + E.get(1, 1) * y1 + E.get(1, 2),
    E.get(2, 0) * x1 + E.get(2, 1) * y1 + E.get(2, 2),
  ]
  const etx2 = [
    E.get(0, 0) * x2 + E.get(1, 0) * y2 + E.get(2, 0),
    E.get(0, 1) * x2 + E.get(1, 1) * y2 + E.get(2, 1),
    E.get(0, 2) * x2 + E.get(1, 2) * y2 + E.get(2, 2),
  ]
  const residual = x2 * ex1[0] + y2 * ex1[1] + ex1[2]
  const denominator = ex1[0] ** 2 + ex1[1] ** 2 + etx2[0] ** 2 + etx2[1] ** 2
  return denominator > 1e-18 ? (residual * residual) / denominator : Number.POSITIVE_INFINITY
}

function seededRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function sampleWithoutReplacement(length, count, random) {
  const chosen = new Set()
  while (chosen.size < count) chosen.add(Math.floor(random() * length))
  return Array.from(chosen)
}

export function estimateEssentialRansac(correspondences, {
  threshold = 0.0025,
  maxIterations = 320,
  seed = 1,
} = {}) {
  if (correspondences.length < 8) return null

  const random = seededRandom(seed)
  const thresholdSquared = threshold * threshold
  let bestInliers = []
  let bestE = null

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const sample = sampleWithoutReplacement(correspondences.length, 8, random)
      .map((index) => correspondences[index])
    const E = eightPointEssential(sample)
    if (!E) continue

    const inliers = []
    for (let i = 0; i < correspondences.length; i += 1) {
      if (sampsonError(E, correspondences[i]) <= thresholdSquared) inliers.push(i)
    }

    if (inliers.length > bestInliers.length) {
      bestInliers = inliers
      bestE = E
      if (bestInliers.length / correspondences.length > 0.82) break
    }
  }

  if (!bestE || bestInliers.length < 8) return null

  const refined = eightPointEssential(bestInliers.map((index) => correspondences[index])) || bestE
  const refinedInliers = []
  for (let i = 0; i < correspondences.length; i += 1) {
    if (sampsonError(refined, correspondences[i]) <= thresholdSquared) refinedInliers.push(i)
  }

  return { E: refined, inlierIndices: refinedInliers }
}

function projection2(R, t) {
  return new Matrix([
    [R.get(0, 0), R.get(0, 1), R.get(0, 2), t[0]],
    [R.get(1, 0), R.get(1, 1), R.get(1, 2), t[1]],
    [R.get(2, 0), R.get(2, 1), R.get(2, 2), t[2]],
  ])
}

function projection1() {
  return new Matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ])
}

function row(matrix, index) {
  return matrix.getRow(index)
}

function combineRows(a, aScale, b, bScale) {
  return a.map((value, index) => value * aScale + b[index] * bScale)
}

export function triangulateNormalized(p1, p2, R, t) {
  const P1 = projection1()
  const P2 = projection2(R, t)
  const A = new Matrix([
    combineRows(row(P1, 2), p1[0], row(P1, 0), -1),
    combineRows(row(P1, 2), p1[1], row(P1, 1), -1),
    combineRows(row(P2, 2), p2[0], row(P2, 0), -1),
    combineRows(row(P2, 2), p2[1], row(P2, 1), -1),
  ])

  const homogeneous = nullVector(A)
  const w = homogeneous[3]
  if (!Number.isFinite(w) || Math.abs(w) < 1e-10) return null
  return [homogeneous[0] / w, homogeneous[1] / w, homogeneous[2] / w]
}

function matVec3(R, vector) {
  return [
    R.get(0, 0) * vector[0] + R.get(0, 1) * vector[1] + R.get(0, 2) * vector[2],
    R.get(1, 0) * vector[0] + R.get(1, 1) * vector[1] + R.get(1, 2) * vector[2],
    R.get(2, 0) * vector[0] + R.get(2, 1) * vector[1] + R.get(2, 2) * vector[2],
  ]
}

function makeRotation(U, middle, V) {
  const R = U.mmul(middle).mmul(V.transpose())
  return det3(R) < 0 ? R.mul(-1) : R
}

export function recoverRelativePose(E, correspondences, inlierIndices) {
  if (!inlierIndices?.length) return null

  const svd = new SingularValueDecomposition(E)
  const U = svd.leftSingularVectors.clone()
  const V = svd.rightSingularVectors.clone()
  if (det3(U) < 0) scaleColumn(U, 2, -1)
  if (det3(V) < 0) scaleColumn(V, 2, -1)

  const rotations = [
    makeRotation(U, W, V),
    makeRotation(U, W.transpose(), V),
  ]
  const baseT = U.getColumn(2)

  let best = null
  const probeIndices = inlierIndices.slice(0, Math.min(80, inlierIndices.length))

  for (const R of rotations) {
    for (const sign of [1, -1]) {
      const t = baseT.map((value) => value * sign)
      let positiveDepth = 0
      const probePoints = []

      for (const index of probeIndices) {
        const correspondence = correspondences[index]
        const point = triangulateNormalized(correspondence.p1, correspondence.p2, R, t)
        if (!point || !point.every(Number.isFinite)) continue
        const second = matVec3(R, point).map((value, axis) => value + t[axis])
        if (point[2] > 0 && second[2] > 0) {
          positiveDepth += 1
          probePoints.push(point)
        }
      }

      if (!best || positiveDepth > best.positiveDepth) {
        best = { R, t, positiveDepth, probePoints }
      }
    }
  }

  return best
}

export function composeWorldToCamera(anchorPose, relativeR, relativeT, baselineScale = 1) {
  const anchorR = new Matrix(anchorPose.rotation)
  const anchorT = anchorPose.translation
  const scaledT = relativeT.map((value) => value * baselineScale)
  const rotation = relativeR.mmul(anchorR)
  const rotatedAnchorT = matVec3(relativeR, anchorT)
  const translation = rotatedAnchorT.map((value, index) => value + scaledT[index])
  return { rotation: rotation.to2DArray(), translation }
}

export function cameraCenterAndForward(pose) {
  const R = new Matrix(pose.rotation)
  const Rt = R.transpose()
  const negativeT = pose.translation.map((value) => -value)
  const center = matVec3(Rt, negativeT)
  const forward = matVec3(Rt, [0, 0, 1])
  return { center, forward }
}

export function cameraPointToWorld(point, pose) {
  const R = new Matrix(pose.rotation)
  const Rt = R.transpose()
  const shifted = point.map((value, index) => value - pose.translation[index])
  return matVec3(Rt, shifted)
}
