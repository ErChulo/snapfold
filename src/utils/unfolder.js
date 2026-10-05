export const LETTER = Object.freeze({
  widthIn: 8.5,
  heightIn: 11,
  marginIn: 0.25,
  headerIn: 0.38,
  legendIn: 0.42,
})

const EPS = 1e-9

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function sidesFromPhotoCount(photoCount) {
  // 20-50 orbital photographs map to a manageable faceted prototype mesh.
  return clamp(Math.round((photoCount || 20) / 3), 6, 16)
}

export function createPrismNet(photoCount = 20) {
  const sides = sidesFromPhotoCount(photoCount)
  const panelWidth = 1
  const panelHeight = 2.25
  const stripY = 2.4
  const capRadius = panelWidth / (2 * Math.sin(Math.PI / sides))

  const faces = []
  const folds = []
  const cutEdges = []
  const tabCandidates = []

  for (let i = 0; i < sides; i += 1) {
    const x0 = i * panelWidth
    const x1 = x0 + panelWidth
    const y0 = stripY
    const y1 = stripY + panelHeight

    faces.push({
      id: `side-${i}`,
      kind: 'side',
      points: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    })

    if (i > 0) {
      folds.push({
        id: `side-fold-${i}`,
        type: 'valley',
        a: { x: x0, y: y0 },
        b: { x: x0, y: y1 },
      })
    }
  }

  const topCap = makeRegularPolygon(
    sides,
    panelWidth,
    { x: panelWidth / 2, y: stripY - capRadius * Math.cos(Math.PI / sides) },
    Math.PI / 2 + Math.PI / sides,
  )
  const bottomCap = makeRegularPolygon(
    sides,
    panelWidth,
    { x: panelWidth / 2, y: stripY + panelHeight + capRadius * Math.cos(Math.PI / sides) },
    -Math.PI / 2 - Math.PI / sides,
  )

  faces.push({ id: 'top-cap', kind: 'cap', points: topCap })
  faces.push({ id: 'bottom-cap', kind: 'cap', points: bottomCap })

  const topAttach = findClosestEdge(topCap, {
    a: { x: 0, y: stripY },
    b: { x: panelWidth, y: stripY },
  })
  const bottomAttach = findClosestEdge(bottomCap, {
    a: { x: 0, y: stripY + panelHeight },
    b: { x: panelWidth, y: stripY + panelHeight },
  })

  folds.push({ id: 'top-cap-fold', type: 'mountain', a: topAttach.a, b: topAttach.b })
  folds.push({ id: 'bottom-cap-fold', type: 'mountain', a: bottomAttach.a, b: bottomAttach.b })

  // Strip perimeter. Panel 0 top/bottom are cap folds rather than cut edges.
  for (let i = 0; i < sides; i += 1) {
    const x0 = i * panelWidth
    const x1 = x0 + panelWidth
    if (i !== 0) {
      cutEdges.push({ a: { x: x0, y: stripY }, b: { x: x1, y: stripY } })
      cutEdges.push({ a: { x: x0, y: stripY + panelHeight }, b: { x: x1, y: stripY + panelHeight } })
    }
  }
  cutEdges.push({ a: { x: 0, y: stripY }, b: { x: 0, y: stripY + panelHeight } })
  cutEdges.push({
    a: { x: sides * panelWidth, y: stripY },
    b: { x: sides * panelWidth, y: stripY + panelHeight },
  })

  edgeList(topCap).forEach((edge, index) => {
    if (index !== topAttach.index) {
      cutEdges.push(edge)
      tabCandidates.push({ ...edge, parentId: 'top-cap' })
    }
  })
  edgeList(bottomCap).forEach((edge, index) => {
    if (index !== bottomAttach.index) {
      cutEdges.push(edge)
      tabCandidates.push({ ...edge, parentId: 'bottom-cap' })
    }
  })

  // One seam tab closes the side strip.
  tabCandidates.push({
    a: { x: sides * panelWidth, y: stripY },
    b: { x: sides * panelWidth, y: stripY + panelHeight },
    parentId: `side-${sides - 1}`,
  })

  const tabs = placeNonOverlappingTabs(tabCandidates, faces, panelWidth * 0.28)
  const bbox = boundsOfGeometry(faces, tabs)

  return {
    sides,
    photoCount,
    faces,
    folds,
    cutEdges,
    tabs,
    bounds: bbox,
  }
}

function makeRegularPolygon(n, sideLength, center, rotation = 0) {
  const radius = sideLength / (2 * Math.sin(Math.PI / n))
  return Array.from({ length: n }, (_, i) => {
    const angle = rotation + (i * Math.PI * 2) / n
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    }
  })
}

function edgeList(points) {
  return points.map((point, index) => ({
    a: point,
    b: points[(index + 1) % points.length],
  }))
}

function findClosestEdge(points, target) {
  const targetMid = midpoint(target.a, target.b)
  let best = null
  edgeList(points).forEach((edge, index) => {
    const m = midpoint(edge.a, edge.b)
    const distance = Math.hypot(m.x - targetMid.x, m.y - targetMid.y)
    if (!best || distance < best.distance) best = { ...edge, index, distance }
  })
  return best
}

function placeNonOverlappingTabs(candidates, faces, nominalDepth) {
  const placed = []

  for (const edge of candidates) {
    let depth = nominalDepth
    let accepted = null

    for (let attempt = 0; attempt < 5 && !accepted; attempt += 1) {
      const parent = faces.find((face) => face.id === edge.parentId)
      const candidate = makeOutwardTrapezoid(edge.a, edge.b, parent.points, depth)

      const hitsFace = faces.some(
        (face) => face.id !== edge.parentId && polygonsOverlap(candidate, face.points),
      )
      const hitsTab = placed.some((tab) => polygonsOverlap(candidate, tab.points))

      if (!hitsFace && !hitsTab) {
        accepted = {
          id: `tab-${placed.length + 1}`,
          parentId: edge.parentId,
          points: candidate,
          base: { a: edge.a, b: edge.b },
        }
      } else {
        depth *= 0.72
      }
    }

    if (accepted) placed.push(accepted)
  }

  return placed
}

function makeOutwardTrapezoid(a, b, parentPoints, depth) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  const normals = [
    { x: -uy, y: ux },
    { x: uy, y: -ux },
  ]
  const faceCenter = polygonCentroid(parentPoints)
  const edgeMid = midpoint(a, b)

  const normal = normals.reduce((best, next) => {
    const bestPoint = { x: edgeMid.x + best.x * depth, y: edgeMid.y + best.y * depth }
    const nextPoint = { x: edgeMid.x + next.x * depth, y: edgeMid.y + next.y * depth }
    const bestDistance = distance(bestPoint, faceCenter)
    const nextDistance = distance(nextPoint, faceCenter)
    return nextDistance > bestDistance ? next : best
  })

  const trim = Math.min(depth, length * 0.22)
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: b.y },
    { x: b.x - ux * trim + normal.x * depth, y: b.y - uy * trim + normal.y * depth },
    { x: a.x + ux * trim + normal.x * depth, y: a.y + uy * trim + normal.y * depth },
  ]
}

export function getLetterTransform(net, scalePercent = 100) {
  const scaleFactor = clamp(scalePercent, 10, 100) / 100
  const { marginIn, widthIn, heightIn, headerIn, legendIn } = LETTER
  const drawable = {
    x: marginIn,
    y: marginIn + headerIn,
    width: widthIn - marginIn * 2,
    height: heightIn - marginIn * 2 - headerIn - legendIn,
  }

  const contentWidth = Math.max(net.bounds.maxX - net.bounds.minX, EPS)
  const contentHeight = Math.max(net.bounds.maxY - net.bounds.minY, EPS)
  const fitScale = Math.min(drawable.width / contentWidth, drawable.height / contentHeight)
  const scale = fitScale * scaleFactor
  const finalWidth = contentWidth * scale
  const finalHeight = contentHeight * scale

  const offsetX = drawable.x + (drawable.width - finalWidth) / 2 - net.bounds.minX * scale
  const offsetY = drawable.y + (drawable.height - finalHeight) / 2 - net.bounds.minY * scale

  return {
    scale,
    scaleFactor,
    drawable,
    point: ({ x, y }) => ({ x: x * scale + offsetX, y: y * scale + offsetY }),
  }
}

function boundsOfGeometry(faces, tabs) {
  const points = [
    ...faces.flatMap((face) => face.points),
    ...tabs.flatMap((tab) => tab.points),
  ]
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

function polygonsOverlap(a, b) {
  const boxA = bounds(a)
  const boxB = bounds(b)
  if (
    boxA.maxX <= boxB.minX + EPS ||
    boxB.maxX <= boxA.minX + EPS ||
    boxA.maxY <= boxB.minY + EPS ||
    boxB.maxY <= boxA.minY + EPS
  ) return false

  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i]
    const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j]
      const b2 = b[(j + 1) % b.length]
      if (segmentsCrossStrictly(a1, a2, b1, b2)) return true
    }
  }

  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a)
}

function segmentsCrossStrictly(a, b, c, d) {
  const o1 = cross(a, b, c)
  const o2 = cross(a, b, d)
  const o3 = cross(c, d, a)
  const o4 = cross(c, d, b)
  return o1 * o2 < -EPS && o3 * o4 < -EPS
}

function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + EPS) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function polygonCentroid(points) {
  const total = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: total.x / points.length, y: total.y / points.length }
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function bounds(points) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
