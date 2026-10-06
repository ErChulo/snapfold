import exifr from 'exifr/dist/lite.esm.mjs'

const FULL_FRAME_DIAGONAL_MM = Math.hypot(36, 24)

function estimateIntrinsics(width, height, metadata) {
  const focal35 = Number(
    metadata?.FocalLengthIn35mmFormat
    ?? metadata?.FocalLengthIn35mmFilm
    ?? metadata?.FocalLengthIn35mm
  )

  const pixelDiagonal = Math.hypot(width, height)
  const focalPixels = Number.isFinite(focal35) && focal35 > 0
    ? pixelDiagonal * focal35 / FULL_FRAME_DIAGONAL_MM
    : 0.92 * Math.max(width, height)

  return {
    fx: focalPixels,
    fy: focalPixels,
    cx: (width - 1) / 2,
    cy: (height - 1) / 2,
    source: Number.isFinite(focal35) && focal35 > 0 ? 'EXIF 35mm-equivalent focal length' : '60°-class fallback estimate',
    focal35mm: Number.isFinite(focal35) ? focal35 : null,
  }
}

async function readMetadata(file) {
  if (!file) return {}
  try {
    return await exifr.parse(file, [
      'Make',
      'Model',
      'Orientation',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      'FocalLengthIn35mmFilm',
      'DateTimeOriginal',
    ]) || {}
  } catch {
    return {}
  }
}

async function imageDataFromPreview(previewUrl, maxDimension) {
  const response = await fetch(previewUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return {
    imageData: context.getImageData(0, 0, width, height),
    width,
    height,
    scale,
  }
}

export async function analyzePhoto(photo, { maxDimension = 1024 } = {}) {
  const [metadata, raster] = await Promise.all([
    readMetadata(photo.sourceFile),
    imageDataFromPreview(photo.previewUrl, maxDimension),
  ])

  return {
    id: photo.id,
    name: photo.name,
    metadata,
    ...raster,
    intrinsics: estimateIntrinsics(raster.width, raster.height, metadata),
  }
}

export function normalizePixel(point, intrinsics) {
  return [
    (point[0] - intrinsics.cx) / intrinsics.fx,
    (point[1] - intrinsics.cy) / intrinsics.fy,
  ]
}
