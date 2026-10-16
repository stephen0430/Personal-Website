import { json, readJsonBody, readSession, setCors } from '../lib/auth.mjs'

const repository = 'stephen0430/Personal-Website'
const cleanLine = value => String(value || '').replace(/[\r\n]+/g, ' ').trim()
const slugify = value => cleanLine(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || `post-${Date.now()}`
const markdownFor = post => `---\ntitle: ${cleanLine(post.title)}\ndate: ${post.date}\ncategory: ${cleanLine(post.category || '随笔')}\ntags: [${(post.tags || []).map(cleanLine).filter(Boolean).join(', ')}]\ncover: /assets/cover.webp\nexcerpt: ${cleanLine(post.excerpt)}\n---\n\n${String(post.content || '').trim()}\n`

export default async function handler(req, res) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  const session = readSession(req)
  if (!session || session.login !== (process.env.ALLOWED_GITHUB_LOGIN || 'stephen0430')) return json(res, 401, { error: 'GitHub login required' })
  try {
    const post = await readJsonBody(req)
    if (!post.title || !/^\d{4}-\d{2}-\d{2}$/.test(post.date || '') || !post.content) return json(res, 400, { error: 'title, date and content are required' })
    const slug = slugify(post.slug || post.title)
    const path = `content/posts/${post.date}-${slug}.md`
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.accessToken}`, 'X-GitHub-Api-Version': '2022-11-28' }
    const existing = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=main`, { headers })
    const existingJson = existing.ok ? await existing.json() : null
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Publish post: ${cleanLine(post.title)}`, content: Buffer.from(markdownFor(post), 'utf8').toString('base64'), branch: 'main', ...(existingJson?.sha ? { sha: existingJson.sha } : {}) })
    })
    const result = await response.json()
    if (!response.ok) return json(res, response.status, { error: result.message || 'GitHub publish failed' })
    return json(res, 200, { ok: true, path, commit: result.commit?.html_url || '' })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Publish failed' })
  }
}
