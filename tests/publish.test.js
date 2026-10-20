import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession } from '../functions/_lib/auth.js'
import { onRequestPost } from '../functions/api/publish.js'

const env = { SESSION_SECRET: 'test-session-secret', ALLOWED_GITHUB_LOGIN: 'stephen0430', ADMIN_ORIGIN: 'https://qxy0430.pages.dev' }
const publishedPath = 'content/posts/2026-10-13-original-slug.md'
const post = overrides => ({
  title: 'Revised title',
  slug: 'original-slug',
  date: '2026-10-13',
  category: '学习',
  categoryEn: 'Learning',
  tags: ['更新'],
  tagsEn: ['Updates'],
  cover: '/assets/custom.webp',
  excerpt: 'New excerpt',
  excerptEn: 'New excerpt in English',
  content: '# Revised content',
  ...overrides
})

const requestFor = async body => {
  const session = await createSession(env, { login: 'stephen0430', accessToken: 'test-github-token' })
  return new Request('https://qxy0430.pages.dev/api/publish', {
    method: 'POST',
    headers: { Cookie: `qxy_session=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

const shanghaiDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const withFetch = async (mock, run) => {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try { return await run() } finally { globalThis.fetch = original }
}

test('updates the original file and preserves its publication date and localized metadata', async () => {
  const originalMarkdown = '---\ntitle: Original\ndate: 2026-10-13\ncategory: 学习\n---\n\nOriginal body\n'
  const calls = []
  const request = await requestFor(post({ sourcePath: publishedPath, date: '2026-10-15' }))

  const response = await withFetch(async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (!init.method) return Response.json({ sha: 'current-sha', content: Buffer.from(originalMarkdown).toString('base64') })
    return Response.json({ commit: { html_url: 'https://github.com/example/commit/abc' } })
  }, () => onRequestPost({ request, env }))

  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.path, publishedPath)
  assert.equal(result.date, '2026-10-13')
  assert.equal(result.updated, shanghaiDate())
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /2026-10-13-original-slug\.md\?ref=main$/)

  const payload = JSON.parse(calls[1].init.body)
  const markdown = Buffer.from(payload.content, 'base64').toString('utf8')
  assert.equal(payload.sha, 'current-sha')
  assert.match(markdown, /\ndate: 2026-10-13\nupdated:/)
  assert.match(markdown, /titleEn: /)
  assert.match(markdown, /categoryEn: Learning/)
  assert.match(markdown, /tagsEn: \[Updates\]/)
  assert.match(markdown, /excerptEn: New excerpt in English/)
  assert.match(markdown, /cover: \/assets\/custom\.webp/)
})

test('rejects unsafe source paths before contacting GitHub', async () => {
  const request = await requestFor(post({ sourcePath: 'content/posts/../../functions/api/auth/login.js' }))
  let called = false
  const response = await withFetch(async () => { called = true; throw new Error('unexpected GitHub request') }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 400)
  assert.equal(called, false)
})

test('does not silently overwrite an existing file when creating a new post', async () => {
  const request = await requestFor(post({ sourcePath: undefined }))
  const response = await withFetch(async () => Response.json({ sha: 'existing-sha' }), () => onRequestPost({ request, env }))
  assert.equal(response.status, 409)
})

test('sets a new post update date to its initial publication date', async () => {
  const calls = []
  const request = await requestFor(post({ sourcePath: undefined }))
  const response = await withFetch(async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (!init.method) return new Response('Not Found', { status: 404 })
    return Response.json({ commit: { html_url: 'https://github.com/example/commit/def' } })
  }, () => onRequestPost({ request, env }))
  const result = await response.json()
  const payload = JSON.parse(calls[1].init.body)
  const markdown = Buffer.from(payload.content, 'base64').toString('utf8')
  assert.equal(response.status, 200)
  assert.equal(result.date, '2026-10-13')
  assert.equal(result.updated, '2026-10-13')
  assert.match(markdown, /\ndate: 2026-10-13\nupdated: 2026-10-13\n/)
  assert.equal(payload.sha, undefined)
})

test('saves an empty cover for category/site fallback', async () => {
  const request = await requestFor(post({ cover: '', sourcePath: undefined }))
  let markdown = ''
  const response = await withFetch(async (_, init = {}) => {
    if (!init.method) return new Response('Not Found', { status: 404 })
    markdown = Buffer.from(JSON.parse(init.body).content, 'base64').toString('utf8')
    return Response.json({ commit: {} })
  }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 200)
  assert.match(markdown, /\ncover: \n/)
})
