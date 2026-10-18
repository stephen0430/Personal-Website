import { json, options, readJson, readSession, withCors } from '../_lib/auth.js'

const repository = 'stephen0430/Personal-Website'
const cleanLine = value => String(value || '').replace(/[\r\n]+/g, ' ').trim()
const slugify = value => cleanLine(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || `post-${Date.now()}`
const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}
const shanghaiToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
const validSourcePath = value => {
  if (typeof value !== 'string' || !value.startsWith('content/posts/')) return false
  const filename = value.slice('content/posts/'.length)
  return /^[\p{L}\p{N}._-]+\.md$/u.test(filename) && filename !== '.md' && !filename.startsWith('.')
}
const markdownFor = (post, date, updated) => {
  const tags = (post.tags || []).map(cleanLine).filter(Boolean)
  const tagsEn = (post.tagsEn || []).map(cleanLine).filter(Boolean)
  return `---\ntitle: ${cleanLine(post.title)}\ntitleEn: ${cleanLine(post.titleEn)}\ndate: ${date}\nupdated: ${updated}\ncategory: ${cleanLine(post.category || '随笔')}\ncategoryEn: ${cleanLine(post.categoryEn)}\ntags: [${tags.join(', ')}]\ntagsEn: [${tagsEn.join(', ')}]\ncover: ${cleanLine(post.cover || '/assets/cover.webp')}\nexcerpt: ${cleanLine(post.excerpt)}\nexcerptEn: ${cleanLine(post.excerptEn)}\nslug: ${cleanLine(post.slug)}\n---\n\n${String(post.content || '').trim()}\n`
}

const toBase64 = value => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

const fromBase64 = value => {
  const binary = atob(value.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)))
}

const readApiResponse = async response => {
  const raw = await response.text()
  try { return { data: JSON.parse(raw || '{}'), raw } } catch { return { data: null, raw } }
}

const dateFromMarkdown = content => {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---(?:\s|$)/)
  const match = frontmatter?.[1].match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)
  return match?.[1] || ''
}

export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestPost({ request, env }) {
  const session = await readSession(env, request)
  if (!session || session.login !== (env.ALLOWED_GITHUB_LOGIN || 'stephen0430')) return withCors(request, env, json({ error: 'GitHub login required' }, 401))
  try {
    const post = await readJson(request)
    if (!post.title || !isValidDate(post.date) || !post.content) return withCors(request, env, json({ error: 'title, valid date and content are required' }, 400))
    const isEdit = post.sourcePath !== undefined && post.sourcePath !== ''
    if (isEdit && !validSourcePath(post.sourcePath)) return withCors(request, env, json({ error: 'Invalid article source path' }, 400))
    const slug = slugify(post.slug || post.title)
    const filePath = isEdit ? post.sourcePath : `content/posts/${post.date}-${slug}.md`
    const apiPath = filePath.split('/').map(encodeURIComponent).join('/')
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.accessToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'QXY-Web-Publisher' }
    const existing = await fetch(`https://api.github.com/repos/${repository}/contents/${apiPath}?ref=main`, { headers })
    const existingPayload = await readApiResponse(existing)

    if (isEdit && existing.status === 404) return withCors(request, env, json({ error: 'The published article no longer exists at its original path. Refresh the article list before editing.' }, 409))
    if (!existing.ok && existing.status !== 404) return withCors(request, env, json({ error: existingPayload.data?.message || `GitHub could not read the article (HTTP ${existing.status})` }, existing.status))
    if (existing.ok && !existingPayload.data) return withCors(request, env, json({ error: `GitHub returned non-JSON while checking the file: ${existingPayload.raw.slice(0, 240)}` }, 502))
    if (!isEdit && existing.ok) return withCors(request, env, json({ error: 'An article already exists at this path. Refresh the published list and edit that article instead.' }, 409))

    const existingJson = existing.ok ? existingPayload.data : null
    const publishedDate = isEdit ? dateFromMarkdown(fromBase64(existingJson.content || '')) : post.date
    if (!isValidDate(publishedDate)) return withCors(request, env, json({ error: 'Could not verify the original publication date. The article was not changed.' }, 409))
    const updated = isEdit ? shanghaiToday() : publishedDate
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${apiPath}`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${isEdit ? 'Update' : 'Publish'} post: ${cleanLine(post.title)}`, content: toBase64(markdownFor({ ...post, slug }, publishedDate, updated)), branch: 'main', ...(existingJson?.sha ? { sha: existingJson.sha } : {}) })
    })
    const payload = await readApiResponse(response)
    const result = payload.data
    if (!response.ok) return withCors(request, env, json({ error: result?.message || `GitHub publish failed (HTTP ${response.status}): ${payload.raw.slice(0, 240)}` }, response.status))
    if (!result) return withCors(request, env, json({ error: `GitHub returned non-JSON after publishing: ${payload.raw.slice(0, 240)}` }, 502))
    return withCors(request, env, json({ ok: true, path: filePath, date: publishedDate, updated, commit: result.commit?.html_url || '' }))
  } catch (error) {
    return withCors(request, env, json({ error: error.message || 'Publish failed' }, 500))
  }
}
