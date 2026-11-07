import { isTrustedOrigin, json, options, readJson, readSession, withCors } from '../_lib/auth.js'
import { validateMedia } from '../_lib/media.js'

const repository = 'stephen0430/Personal-Website'
const cleanLine = value => String(value || '').replace(/[\r\n]+/g, ' ').trim()
const yamlScalar = value => JSON.stringify(String(value || '').trim())
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
const validCover = value => {
  if (!value) return true
  if (typeof value === 'string' && /^qxy-upload:\/\/[0-9a-f-]{36}$/i.test(value)) return true
  if (typeof value !== 'string' || /[\r\n<>"']/.test(value)) return false
  if (value.startsWith('/')) return !value.startsWith('//') && !/\s/.test(value)
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}
const markdownFor = (post, date, updated) => {
  const tags = (post.tags || []).map(cleanLine).filter(Boolean)
  const tagsEn = (post.tagsEn || []).map(cleanLine).filter(Boolean)
  return `---\ntitle: ${yamlScalar(post.title)}\ntitleEn: ${yamlScalar(post.titleEn)}\ndate: ${date}\nupdated: ${updated}\ncategory: ${yamlScalar(post.category || '随笔')}\ncategoryEn: ${yamlScalar(post.categoryEn)}\ntags: ${JSON.stringify(tags)}\ntagsEn: ${JSON.stringify(tagsEn)}\ncover: ${yamlScalar(post.cover)}\nexcerpt: ${yamlScalar(post.excerpt)}\nexcerptEn: ${yamlScalar(post.excerptEn)}\nslug: ${yamlScalar(post.slug)}\n---\n\n${String(post.content || '').trim()}\n`
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
  if (!isTrustedOrigin(request, env)) return withCors(request, env, json({ error: 'Untrusted request origin' }, 403))

  try {
    const post = await readJson(request, 16 * 1024 * 1024)
    if (!post.title || !isValidDate(post.date) || !post.content) return withCors(request, env, json({ error: 'title, valid date and content are required' }, 400))
    if (!validCover(post.cover)) return withCors(request, env, json({ error: 'Invalid cover URL' }, 400))
    const isEdit = post.sourcePath !== undefined && post.sourcePath !== ''
    if (isEdit && !validSourcePath(post.sourcePath)) return withCors(request, env, json({ error: 'Invalid article source path' }, 400))

    const slug = slugify(post.slug || post.title)
    const filePath = isEdit ? post.sourcePath : `content/posts/${post.date}-${slug}.md`
    const apiPath = filePath.split('/').map(encodeURIComponent).join('/')
    const { media } = validateMedia(post.media)
    const mediaById = new Map(media.map(item => [item.id, item]))
    const sourceContent = String(post.content || '')
    const sourceCover = String(post.cover || '')
    const referencedIds = new Set([...`${sourceContent}\n${sourceCover}`.matchAll(/qxy-upload:\/\/([0-9a-f-]{36})/gi)].map(match => match[1]))
    if ([...referencedIds].some(id => !mediaById.has(id)) || media.some(item => !referencedIds.has(item.id))) {
      return withCors(request, env, json({ error: 'The staged image list does not match the article references. Save the draft and select its images again.' }, 400))
    }

    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.accessToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'QXY-Web-Publisher' }
    const gitApi = `https://api.github.com/repos/${repository}/git`
    const refResponse = await fetch(`${gitApi}/ref/heads/main`, { headers })
    const refPayload = await readApiResponse(refResponse)
    if (!refResponse.ok || !refPayload.data?.object?.sha) return withCors(request, env, json({ error: refPayload.data?.message || 'Could not read the current publication branch.' }, refResponse.status || 502))
    const parentSha = refPayload.data.object.sha

    const existing = await fetch(`https://api.github.com/repos/${repository}/contents/${apiPath}?ref=${encodeURIComponent(parentSha)}`, { headers })
    const existingPayload = await readApiResponse(existing)
    if (isEdit && existing.status === 404) return withCors(request, env, json({ error: 'The published article no longer exists at its original path. Refresh the article list before editing.' }, 409))
    if (!existing.ok && existing.status !== 404) return withCors(request, env, json({ error: existingPayload.data?.message || `GitHub could not read the article (HTTP ${existing.status})` }, existing.status))
    if (existing.ok && !existingPayload.data) return withCors(request, env, json({ error: `GitHub returned non-JSON while checking the file: ${existingPayload.raw.slice(0, 240)}` }, 502))
    if (!isEdit && existing.ok) return withCors(request, env, json({ error: 'An article already exists at this path. Refresh the published list and edit that article instead.' }, 409))

    const originalMarkdown = existing.ok ? fromBase64(existingPayload.data.content || '') : ''
    const publishedDate = isEdit ? dateFromMarkdown(originalMarkdown) : post.date
    if (!isValidDate(publishedDate)) return withCors(request, env, json({ error: 'Could not verify the original publication date. The article was not changed.' }, 409))

    const updated = isEdit ? shanghaiToday() : publishedDate
    const mediaPath = item => `assets/posts/${slug}/${item.id}-${item.filename}`
    const resolveMedia = value => String(value || '').replace(/qxy-upload:\/\/([0-9a-f-]{36})/gi, (_, id) => `/${mediaPath(mediaById.get(id))}`)
    const finalPost = { ...post, slug, cover: resolveMedia(sourceCover), content: resolveMedia(sourceContent) }
    const markdown = markdownFor(finalPost, publishedDate, updated)
    const entryList = []

    for (const item of media) {
      const response = await fetch(`${gitApi}/blobs`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.data, encoding: 'base64' })
      })
      const payload = await readApiResponse(response)
      if (!response.ok || !payload.data?.sha) return withCors(request, env, json({ error: payload.data?.message || 'GitHub could not stage an image.' }, response.status || 502))
      entryList.push({ path: mediaPath(item), mode: '100644', type: 'blob', sha: payload.data.sha })
    }

    const articleBlobResponse = await fetch(`${gitApi}/blobs`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: toBase64(markdown), encoding: 'base64' })
    })
    const articleBlobPayload = await readApiResponse(articleBlobResponse)
    if (!articleBlobResponse.ok || !articleBlobPayload.data?.sha) return withCors(request, env, json({ error: articleBlobPayload.data?.message || 'GitHub could not stage the article.' }, articleBlobResponse.status || 502))
    entryList.push({ path: filePath, mode: '100644', type: 'blob', sha: articleBlobPayload.data.sha })

    const parentResponse = await fetch(`${gitApi}/commits/${encodeURIComponent(parentSha)}`, { headers })
    const parentPayload = await readApiResponse(parentResponse)
    if (!parentResponse.ok || !parentPayload.data?.tree?.sha) return withCors(request, env, json({ error: parentPayload.data?.message || 'Could not read the current Git tree.' }, parentResponse.status || 502))

    const treeResponse = await fetch(`${gitApi}/trees`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: parentPayload.data.tree.sha, tree: entryList })
    })
    const treePayload = await readApiResponse(treeResponse)
    if (!treeResponse.ok || !treePayload.data?.sha) return withCors(request, env, json({ error: treePayload.data?.message || 'GitHub could not assemble the publication.' }, treeResponse.status || 502))

    const commitResponse = await fetch(`${gitApi}/commits`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${isEdit ? 'Update' : 'Publish'} post: ${cleanLine(post.title)}`, tree: treePayload.data.sha, parents: [parentSha] })
    })
    const commitPayload = await readApiResponse(commitResponse)
    if (!commitResponse.ok || !commitPayload.data?.sha) return withCors(request, env, json({ error: commitPayload.data?.message || 'GitHub could not create the publication commit.' }, commitResponse.status || 502))

    const updateResponse = await fetch(`${gitApi}/refs/heads/main`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commitPayload.data.sha, force: false })
    })
    const updatePayload = await readApiResponse(updateResponse)
    if (!updateResponse.ok) return withCors(request, env, json({ error: updateResponse.status === 422 ? 'The site changed while publishing. Refresh the article and retry; nothing was overwritten.' : updatePayload.data?.message || 'Could not publish the prepared commit.' }, updateResponse.status === 422 ? 409 : updateResponse.status))
    return withCors(request, env, json({ ok: true, path: filePath, date: publishedDate, updated, commit: commitPayload.data.html_url || '', mediaPaths: media.map(mediaPath) }))
  } catch (error) {
    const status = /Request too large/.test(error.message) ? 413 : /Invalid|At most|Each image|Images total/.test(error.message) ? 400 : 500
    return withCors(request, env, json({ error: error.message || 'Publish failed' }, status))
  }
}
