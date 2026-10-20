import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession } from '../functions/_lib/auth.js'
import { onRequestPost } from '../functions/api/cover.js'

const env = { SESSION_SECRET: 'cover-test-secret', ALLOWED_GITHUB_LOGIN: 'stephen0430' }
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64')
const requestFor = async (body, authenticated = true) => {
  const cookie = authenticated ? `qxy_session=${await createSession(env, { login: 'stephen0430', accessToken: 'test-token' })}` : ''
  return new Request('https://qxy0430.pages.dev/api/cover', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify(body) })
}
const withFetch = async (mock, run) => {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try { return await run() } finally { globalThis.fetch = original }
}

test('cover upload requires a GitHub session', async () => {
  const response = await onRequestPost({ request: await requestFor({ type: 'image/png', data: png }, false), env })
  assert.equal(response.status, 401)
})

test('rejects non-image contents without contacting GitHub', async () => {
  let called = false
  const request = await requestFor({ type: 'image/png', data: Buffer.from('not a png').toString('base64') })
  const response = await withFetch(async () => { called = true }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 400)
  assert.equal(called, false)
})

test('saves a verified image in a unique cover path', async () => {
  let called
  const request = await requestFor({ type: 'image/png', data: png })
  const response = await withFetch(async (url, init) => {
    called = { url: String(url), init }
    return Response.json({ content: { sha: 'uploaded' } })
  }, () => onRequestPost({ request, env }))
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.match(result.path, /^\/assets\/covers\/[0-9a-f-]+\.png$/)
  assert.equal(called.url.endsWith(result.path), true)
  assert.equal(JSON.parse(called.init.body).content, png)
})
