import assert from 'node:assert/strict'
import test from 'node:test'
import { validateMedia } from '../functions/_lib/media.js'

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64')
const image = overrides => ({ id: '12345678-1234-4234-9234-123456789abc', name: 'cover.png', type: 'image/png', data: png, ...overrides })

test('validates image signatures and returns sanitized upload metadata', () => {
  const result = validateMedia([image({ name: '../cover image.png' })])
  assert.equal(result.media[0].filename, 'cover-image.png')
  assert.equal(result.media[0].bytes.length, 12)
})

test('rejects a MIME type that does not match the image signature', () => {
  assert.throws(() => validateMedia([image({ type: 'image/jpeg' })]), /do not match/)
})

test('uses an extension that matches the validated image type', () => {
  assert.equal(validateMedia([image({ name: 'photo.jpg' })]).media[0].filename, 'photo.png')
  assert.equal(validateMedia([image({ name: 'no-extension' })]).media[0].filename, 'no-extension.png')
})

test('rejects malformed base64 and duplicate IDs', () => {
  assert.throws(() => validateMedia([image({ data: '%%%' })]), /encoding/)
  assert.throws(() => validateMedia([image(), image()]), /duplicate/)
})
