import heic2any from 'heic2any'

const HEIC_EXTENSIONS = ['.heic', '.heif']
const RASTER_EXTENSIONS = ['.jpg', '.jpeg', '.png', ...HEIC_EXTENSIONS]

export function isSupportedImage(file) {
  const name = file.name.toLowerCase()
  return RASTER_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export async function makePreviewRecord(file) {
  if (!isSupportedImage(file)) {
    throw new Error(`${file.name}: unsupported format`)
  }

  const lower = file.name.toLowerCase()
  const isHeic = HEIC_EXTENSIONS.some((ext) => lower.endsWith(ext))
  let previewBlob = file

  if (isHeic) {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    previewBlob = Array.isArray(converted) ? converted[0] : converted
  }

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    sourceFile: file,
    previewUrl: URL.createObjectURL(previewBlob),
    convertedFromHeic: isHeic,
  }
}

export function revokePreview(record) {
  if (record?.previewUrl) URL.revokeObjectURL(record.previewUrl)
}
