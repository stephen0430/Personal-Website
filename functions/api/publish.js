import { json, options, readJson, readSession, withCors } from '../_lib/auth.js'

const repository = 'stephen0430/Personal-Website'
const cleanLine = value => String(value || '').replace(/[\r\n]+/g, ' ').trim()
const slugify = value => cleanLine(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || `post-${Date.now()}`
const markdownFor = post => `---\ntitle: ${cleanLine(post.title)}\ndate: ${post.date}\ncategory: ${cleanLine(post.category || '随笔')}\ntags: [${(post.tags || []).map(cleanLine).filter(Boolean).join(', ')}]\ncover: /assets/cover.webp\nexcerpt: ${cleanLine(post.excerpt)}\n---\n\n${String(post.content || '').trim()}\n`

const toBase64 = value => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

const readApiResponse = async response => {
  const raw = await response.text()
  try { return { data: JSON.parse(raw || '{}'), raw } } catch { return { data: null, raw } }
}

export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestPost({ request, env }) {
  const session = await readSession(env, request)
  if (!session || session.login !== (env.ALLOWED_GITHUB_LOGIN || 'stephen0430')) return withCors(request, env, json({ error: 'GitHub login required' }, 401))
  try {
    const post = await readJson(request)
    if (!post.title || !/^\d{4}-\d{2}-\d{2}$/.test(post.date || '') || !post.content) return withCors(request, env, json({ error: 'title, date and content are required' }, 400))
    const slug = slugify(post.slug || post.title)
    const filePath = `content/posts/${post.date}-${slug}.md`
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.accessToken}`, 'X-GitHub-Api-Version': '2022-11-28' }
    const existing = await fetch(`https://api.github.com/repos/${repository}/contents/${filePath}?ref=main`, { headers })
    const existingPayload = await readApiResponse(existing)
    const existingJson = existing.ok ? existingPayload.data : null
    if (existing.ok && !existingJson) return withCors(request, env, json({ error: `GitHub returned non-JSON while checking the file: ${existingPayload.raw.slice(0, 240)}` }, 502))
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${filePath}`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Publish post: ${cleanLine(post.title)}`, content: toBase64(markdownFor(post)), branch: 'main', ...(existingJson?.sha ? { sha: existingJson.sha } : {}) })
    })
    const payload = await readApiResponse(response)
    const result = payload.data
    if (!response.ok) return withCors(request, env, json({ error: result?.message || `GitHub publish failed (HTTP ${response.status}): ${payload.raw.slice(0, 240)}` }, response.status))
    if (!result) return withCors(request, env, json({ error: `GitHub returned non-JSON after publishing: ${payload.raw.slice(0, 240)}` }, 502))
    return withCors(request, env, json({ ok: true, path: filePath, commit: result.commit?.html_url || '' }))
  } catch (error) {
    return withCors(request, env, json({ error: error.message || 'Publish failed' }, 500))
  }
}
