import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession } from '../functions/_lib/auth.js'
import { onRequestPost } from '../functions/api/publish.js'

const env = { SESSION_SECRET: 'test-session-secret', ALLOWED_GITHUB_LOGIN: 'stephen0430', ADMIN_ORIGIN: 'https://qxy0430.pages.dev' }
const publishedPath = 'content/posts/2026-10-13-original-slug.md'
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64')
const imageId = '12345678-1234-4234-9234-123456789abc'
const post = overrides => ({
  title: 'Revised title', slug: 'original-slug', date: '2026-10-13', category: '学习', categoryEn: 'Learning',
  tags: ['更新'], tagsEn: ['Updates'], cover: '/assets/custom.webp', excerpt: 'New excerpt',
  excerptEn: 'New excerpt in English', content: 'Revised body', ...overrides
})

const requestFor = async (body, origin = env.ADMIN_ORIGIN) => {
  const session = await createSession(env, { login: 'stephen0430', accessToken: 'test-github-token' })
  return new Request(`${env.ADMIN_ORIGIN}/api/publish`, {
    method: 'POST',
    headers: { Cookie: `qxy_session=${session}`, Origin: origin, 'Content-Type': 'application/json' },
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

const mockGitHub = ({ originalMarkdown = null, staleRef = false } = {}) => {
  const calls = []
  let blobIndex = 0
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), init }
    calls.push(call)
    const parsed = new URL(call.url)
    if (parsed.pathname.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'parent-sha' } })
    if (parsed.pathname.includes('/contents/')) {
      if (originalMarkdown === null) return new Response('Not Found', { status: 404 })
      return Response.json({ sha: 'article-sha', content: Buffer.from(originalMarkdown).toString('base64') })
    }
    if (parsed.pathname.endsWith('/git/commits/parent-sha')) return Response.json({ tree: { sha: 'base-tree' } })
    if (parsed.pathname.endsWith('/git/blobs')) return Response.json({ sha: `blob-${++blobIndex}` })
    if (parsed.pathname.endsWith('/git/trees')) return Response.json({ sha: 'new-tree' })
    if (parsed.pathname.endsWith('/git/commits')) return Response.json({ sha: 'new-commit', html_url: 'https://github.com/example/commit/new' })
    if (parsed.pathname.endsWith('/git/refs/heads/main')) return staleRef
      ? Response.json({ message: 'Update is not a fast forward' }, { status: 422 })
      : Response.json({ object: { sha: 'new-commit' } })
    throw new Error(`Unexpected GitHub API call: ${init.method || 'GET'} ${call.url}`)
  }
  return { calls, fetch }
}

test('publishes an article and its staged image in one Git commit', async () => {
  const request = await requestFor(post({ cover: `qxy-upload://${imageId}`, content: `![cover](qxy-upload://${imageId})`, media: [{ id: imageId, name: 'cover image.png', type: 'image/png', data: png }] }))
  const github = mockGitHub()
  const response = await withFetch(github.fetch, () => onRequestPost({ request, env }))
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.date, '2026-10-13')
  assert.equal(result.mediaPaths.length, 1)

  const blobCalls = github.calls.filter(call => new URL(call.url).pathname.endsWith('/git/blobs'))
  const imagePath = `assets/posts/original-slug/${imageId}-cover-image.png`
  assert.equal(blobCalls.length, 2)
  assert.equal(JSON.parse(blobCalls[0].init.body).content, png)
  const treeCall = github.calls.find(call => new URL(call.url).pathname.endsWith('/git/trees'))
  const tree = JSON.parse(treeCall.init.body)
  assert.equal(tree.base_tree, 'base-tree')
  assert.deepEqual(tree.tree.map(entry => entry.path), [imagePath, publishedPath])

  const commitCall = github.calls.find(call => new URL(call.url).pathname.endsWith('/git/commits') && call.init.method === 'POST')
  assert.deepEqual(JSON.parse(commitCall.init.body).parents, ['parent-sha'])
  const updateCall = github.calls.find(call => new URL(call.url).pathname.endsWith('/git/refs/heads/main') && call.init.method === 'PATCH')
  assert.equal(JSON.parse(updateCall.init.body).force, false)
  const articleBlob = JSON.parse(blobCalls[1].init.body)
  const markdown = Buffer.from(articleBlob.content, 'base64').toString('utf8')
  assert.match(markdown, new RegExp(`cover: "/${imagePath.replaceAll('/', '\\/')}"`))
  assert.match(markdown, new RegExp(`!\\[cover\\]\\(/${imagePath.replaceAll('/', '\\/')}\\)`))
  assert.match(markdown, /title: "Revised title"/)
  assert.equal(github.calls.filter(call => new URL(call.url).pathname.includes('/contents/')).length, 1)
})

test('updates the original file and preserves its publication date', async () => {
  const originalMarkdown = '---\ntitle: "Original"\ndate: 2026-10-13\ncategory: "学习"\n---\n\nOriginal body\n'
  const request = await requestFor(post({ sourcePath: publishedPath, date: '2026-10-15' }))
  const github = mockGitHub({ originalMarkdown })
  const response = await withFetch(github.fetch, () => onRequestPost({ request, env }))
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.path, publishedPath)
  assert.equal(result.date, '2026-10-13')
  assert.equal(result.updated, shanghaiDate())
  const blobCall = github.calls.find(call => new URL(call.url).pathname.endsWith('/git/blobs') && call.init.method === 'POST')
  const markdown = Buffer.from(JSON.parse(blobCall.init.body).content, 'base64').toString('utf8')
  assert.match(markdown, /date: 2026-10-13\nupdated:/)
  assert.match(markdown, /categoryEn: "Learning"/)
  assert.match(markdown, /tagsEn: \["Updates"\]/)
  assert.match(markdown, /cover: "\/assets\/custom\.webp"/)
})

test('rejects unsafe source paths before contacting GitHub', async () => {
  const request = await requestFor(post({ sourcePath: 'content/posts/../../functions/api/auth/login.js' }))
  let called = false
  const response = await withFetch(async () => { called = true; throw new Error('unexpected GitHub request') }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 400)
  assert.equal(called, false)
})

test('requires an authenticated session before calling GitHub', async () => {
  const request = new Request(`${env.ADMIN_ORIGIN}/api/publish`, {
    method: 'POST', headers: { Origin: env.ADMIN_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(post())
  })
  let called = false
  const response = await withFetch(async () => { called = true }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 401)
  assert.equal(called, false)
})

test('rejects cross-origin publishing requests', async () => {
  const request = await requestFor(post(), 'https://evil.example')
  let called = false
  const response = await withFetch(async () => { called = true }, () => onRequestPost({ request, env }))
  assert.equal(response.status, 403)
  assert.equal(called, false)
})

test('does not overwrite an existing article when publishing a new one', async () => {
  const request = await requestFor(post({ sourcePath: undefined }))
  const github = mockGitHub({ originalMarkdown: 'existing' })
  const response = await withFetch(github.fetch, () => onRequestPost({ request, env }))
  assert.equal(response.status, 409)
  assert.equal(github.calls.some(call => call.init.method === 'POST'), false)
})

test('aborts without moving the branch if another commit lands during publication', async () => {
  const request = await requestFor(post())
  const github = mockGitHub({ staleRef: true })
  const response = await withFetch(github.fetch, () => onRequestPost({ request, env }))
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /site changed/i)
})

test('rejects media references that do not match staged image data', async () => {
  const request = await requestFor(post({ content: `![missing](qxy-upload://${imageId})`, media: [] }))
  let called = false
  const response = await withFetch(async () => { called = true }, () => onRequestPost({ request, env }))
  const result = await response.json()
  assert.equal(response.status, 400, JSON.stringify(result))
  assert.equal(called, false)
})
