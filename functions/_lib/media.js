const formats = {
  'image/jpeg': { extension: 'jpg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: bytes => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) },
  'image/webp': { extension: 'webp', signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
  'image/gif': { extension: 'gif', signature: bytes => ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6))) }
}

export const MAX_MEDIA_FILE_BYTES = 3 * 1024 * 1024
export const MAX_MEDIA_TOTAL_BYTES = 8 * 1024 * 1024
export const MAX_MEDIA_COUNT = 12

const cleanFilename = (value, extension) => {
  const name = String(value || 'image')
  .normalize('NFKC')
  .split(/[\\/]/)
  .at(-1)
  .replace(/[^\p{L}\p{N}._-]+/gu, '-')
  .replace(/^\.+|\.+$/g, '')
  .slice(0, 80) || 'image'
  const stem = name.replace(/\.[^.]*$/, '').replace(/^\.+|\.+$/g, '') || 'image'
  return `${stem}.${extension}`
}

export const validateMedia = items => {
  if (items === undefined) return { media: [], totalBytes: 0 }
  if (!Array.isArray(items) || items.length > MAX_MEDIA_COUNT) throw new Error(`At most ${MAX_MEDIA_COUNT} images can be published together.`)

  const ids = new Set()
  let totalBytes = 0
  const media = items.map(item => {
    if (!item || typeof item !== 'object' || !/^[0-9a-f-]{36}$/i.test(item.id || '') || ids.has(item.id)) throw new Error('Invalid or duplicate image ID.')
    ids.add(item.id)
    const format = formats[item.type]
    if (!format || typeof item.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.data)) throw new Error('Invalid image format or encoding.')
    let binary
    try { binary = atob(item.data) } catch { throw new Error('Invalid image encoding.') }
    if (!binary.length || binary.length > MAX_MEDIA_FILE_BYTES) throw new Error('Each image must be 3 MB or smaller.')
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    if (!format.signature(bytes.slice(0, 12))) throw new Error('Image contents do not match the declared file type.')
    totalBytes += bytes.length
    if (totalBytes > MAX_MEDIA_TOTAL_BYTES) throw new Error('Images total must be 8 MB or smaller per publish.')
    return {
      id: item.id,
      type: item.type,
      filename: cleanFilename(item.name, format.extension),
      data: item.data,
      size: bytes.length,
      bytes
    }
  })
  return { media, totalBytes }
}
