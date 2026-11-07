import assert from 'node:assert/strict'
import test from 'node:test'
import { onRequestPost } from '../functions/api/cover.js'

test('retired standalone uploads return a clear Gone response without writing to GitHub', async () => {
  const request = new Request('https://qxy0430.pages.dev/api/cover', {
    method: 'POST',
    headers: { Origin: 'https://qxy0430.pages.dev', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'image/png', data: 'unused' })
  })
  const response = await onRequestPost({ request, env: {} })
  assert.equal(response.status, 410)
  assert.match((await response.json()).error, /published atomically/i)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
