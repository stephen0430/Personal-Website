import { parseMarkdownPost } from './admin-markdown.js'
import { clearDraftMedia, deleteDraftMedia, getDraftMedia, getDraftSnapshot, listDraftMedia, pruneDraftMedia, putDraftMedia, saveDraftSnapshot } from './media-store.js'

const STORAGE_KEY = 'qxy-drafts'
const html = document.documentElement
const toast = document.querySelector('#toast')
const readLocal = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const state = { publishedPosts: [], drafts: [], active: null, theme: readLocal('qxy-theme', 'light'), site: null, authenticated: false, draftsPersisted: true, snapshotWrite: Promise.resolve() }
const mediaUrls = new Map()
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MAX_DRAFT_MEDIA_BYTES = 8 * 1024 * 1024
const MAX_DRAFT_MEDIA_COUNT = 12

const shanghaiToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const showToast = message => {
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 1800)
}

const setTheme = theme => {
  state.theme = theme
  html.dataset.theme = theme
  try { localStorage.setItem('qxy-theme', theme) } catch { showToast('浏览器存储不可用，主题设置不会保留') }
  document.querySelector('#adminTheme').textContent = theme === 'dark' ? '☼' : '☾'
}

const saveDrafts = () => {
  const snapshot = { savedAt: Date.now(), drafts: state.drafts }
  let localSaved = false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    localSaved = true
  } catch {}
  state.draftsPersisted = localSaved
  document.querySelector('#saveStatus').textContent = localSaved
    ? `草稿已保存到此浏览器：${new Date().toLocaleTimeString()}`
    : '正在将草稿备份到本机 IndexedDB…'
  state.snapshotWrite = saveDraftSnapshot(snapshot).then(() => {
    state.draftsPersisted = true
    if (!localSaved) document.querySelector('#saveStatus').textContent = 'localStorage 不可用，草稿已备份到本机 IndexedDB。'
  }).catch(() => {
    state.draftsPersisted = localSaved
    if (!localSaved) document.querySelector('#saveStatus').textContent = '本机无法保存草稿。请先导出 Markdown 备份再发布。'
  })
  return localSaved
}
const slugify = title => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || `post-${Date.now()}`
const apiBase = () => {
  const configured = String(state.site?.publicationApi || '').replace(/\/$/, '')
  if (configured && !configured.includes('YOUR-CLOUDFLARE-PAGES')) return configured
  return location.hostname.endsWith('.pages.dev') ? location.origin : ''
}
const isApiConfigured = () => Boolean(apiBase())
const returnUrl = () => `${location.origin}${location.pathname}`

const publishLogin = () => {
  if (!isApiConfigured()) {
    showToast('还没有配置发布后端，请先部署 Cloudflare Pages')
    return
  }
  location.href = `${apiBase()}/api/auth/login?return=${encodeURIComponent(returnUrl())}`
}

const checkAuth = async () => {
  if (!isApiConfigured()) {
    document.querySelector('#publishPost').disabled = true
    document.querySelector('#loginGithub').textContent = '等待配置发布后端'
    document.querySelector('#saveStatus').textContent = '发布后端尚未配置，当前可保存草稿或导出 Markdown。'
    return false
  }
  document.querySelector('#publishPost').disabled = false
  try {
    const response = await fetch(`${apiBase()}/api/auth/me`, { credentials: 'include' })
    const raw = await response.text()
    let data
    try { data = JSON.parse(raw || '{}') } catch { throw new Error(`发布接口返回了非 JSON 响应（HTTP ${response.status}）：${raw.slice(0, 240)}`) }
    state.authenticated = Boolean(data.authenticated)
    document.querySelector('#loginGithub').textContent = state.authenticated ? `GitHub：${data.login}` : '登录 GitHub'
    return state.authenticated
  } catch {
    return false
  }
}

const blankPost = () => ({ id: `draft-${Date.now()}`, slug: '', title: '', date: shanghaiToday(), updated: '', category: '随笔', tags: [], cover: '', excerpt: '', content: '' })
const authErrorMessage = reason => ({
  oauth_denied: 'GitHub 拒绝了本次授权。请重新登录并完成授权。',
  state_cookie_missing: '浏览器没有带回 OAuth 临时 Cookie。请确认登录和回调都使用 qxy0430.pages.dev 域名。',
  state_mismatch: 'OAuth state 校验失败。请重新登录；若仍失败，清除此站点 Cookie 后再试。',
  authorization_code_missing: 'GitHub 没有返回授权码，请重新登录。',
  oauth_config_missing: 'Cloudflare 缺少 GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET 或 GITHUB_CALLBACK_URL。',
  session_secret_missing: 'Cloudflare 缺少 SESSION_SECRET，请添加 Secret 并重新部署。',
  token_exchange_failed: 'GitHub 没有接受 Client Secret、回调地址或 PKCE 校验，请核对这些配置。',
  token_request_failed: 'Cloudflare 无法连接 GitHub 的 token 接口，请稍后重试并检查 Functions 日志。',
  token_response_invalid: 'GitHub token 接口返回了非 JSON 响应，请检查 Cloudflare Functions 日志。',
  github_profile_request_failed: 'Cloudflare 无法读取 GitHub 用户信息，请检查 Functions 网络请求日志。',
  github_profile_failed: '授权后读取 GitHub 账号失败，请检查 OAuth App 的 read:user 权限。',
  github_account_not_allowed: '登录账号不在允许名单中；ALLOWED_GITHUB_LOGIN 应为 stephen0430。',
  session_creation_failed: '创建登录会话失败，请检查 SESSION_SECRET。',
  callback_internal_error: 'OAuth 回调内部错误，请查看 Cloudflare Pages Functions 日志。'
}[reason] || '未识别的 OAuth 错误，请查看 Cloudflare Pages Functions 日志。')

const postKey = post => post.sourcePath || `${post.date}-${post.slug}`
const categoryNames = () => [...new Set([...state.publishedPosts, ...state.drafts].map(post => String(post.category || '').trim()).filter(Boolean))]
const getActivePost = () => {
  if (!state.active) return null
  return state.active.kind === 'draft'
    ? state.drafts.find(post => post.id === state.active.id) || null
    : state.publishedPosts.find(post => postKey(post) === state.active.key) || null
}
const findDraftFor = post => state.drafts.find(draft => draft.sourcePath && draft.sourcePath === post.sourcePath)

const coverUrl = value => {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//') && !/[\\\s<>"']/u.test(url)) return url
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''
  } catch { return '' }
}
const coverPreviews = new Map()
const mediaOwner = post => post.sourcePath || post.id
const previewAssetUrl = url => coverPreviews.get(url) || mediaUrls.get(url) || (url.startsWith('/') && location.hostname.endsWith('.github.io') ? `/${location.pathname.split('/').filter(Boolean)[0]}${url}` : url)
const effectiveCover = post => coverUrl(post.cover) || coverUrl(state.site?.categoryCovers?.[post.category]) || coverUrl(state.site?.defaultCover) || '/assets/cover.webp'
const updateCoverPreview = () => {
  const value = document.querySelector('#postCover').value.trim()
  const image = document.querySelector('#coverPreview')
  const staged = coverPreviews.get(value) || mediaUrls.get(value)
  image.src = staged || previewAssetUrl(coverUrl(value) || effectiveCover({ category: document.querySelector('#postCategory').value }))
  image.alt = value ? '当前文章封面预览' : '默认封面预览'
  if (staged?.startsWith('blob:')) image.dataset.staged = 'true'
  else delete image.dataset.staged
}

const readForm = () => {
  const base = getActivePost() || blankPost()
  return {
    ...base,
    title: document.querySelector('#postTitle').value.trim(),
    date: base.sourcePath ? base.date : document.querySelector('#postDate').value,
    category: document.querySelector('#postCategory').value.trim() || '随笔',
    tags: document.querySelector('#postTags').value.split(',').map(item => item.trim()).filter(Boolean),
    cover: document.querySelector('#postCover').value.trim(),
    excerpt: document.querySelector('#postExcerpt').value.trim(),
    content: document.querySelector('#postContent').value
  }
}

const fillForm = post => {
  const isDraft = state.active?.kind === 'draft'
  const isPublished = Boolean(post.sourcePath)
  document.querySelector('#editorTitle').textContent = `${post.title || '新文章'} · ${isPublished ? (isDraft ? '修改草稿' : '已发布') : '本地草稿'}`
  document.querySelector('#postTitle').value = post.title || ''
  document.querySelector('#postDate').value = post.date || shanghaiToday()
  document.querySelector('#postDate').disabled = isPublished
  document.querySelector('#postDateNote').textContent = isPublished ? '编辑线上文章时保留原发布日期。' : '发布日期用于首页排序和归档。'
  document.querySelector('#postCategory').value = post.category || '随笔'
  document.querySelector('#categoryNote').textContent = `类别：${categoryNames().join('、') || '暂无'}`
  document.querySelector('#postTags').value = (post.tags || []).join(', ')
  document.querySelector('#postCover').value = post.cover || ''
  updateCoverPreview()
  document.querySelector('#postExcerpt').value = post.excerpt || ''
  document.querySelector('#postContent').value = post.content || ''
  document.querySelector('#savePost').textContent = isPublished ? '保存本地修改' : '保存草稿'
  document.querySelector('#publishPost').textContent = isPublished ? '发布更新' : '发布新文章'
  document.querySelector('#importUpdateMarkdown').hidden = !isPublished
  document.querySelector('#deletePost').hidden = !isDraft
  document.querySelector('#deletePost').disabled = !isDraft
  restoreMediaPreviews(post)
}

const renderList = () => {
  const publishedList = document.querySelector('#publishedPostList')
  const draftList = document.querySelector('#draftPostList')
  publishedList.innerHTML = state.publishedPosts.length ? state.publishedPosts.map((post, index) => {
    const key = postKey(post)
    const draft = findDraftFor(post)
    const active = state.active?.kind === 'published' && state.active.key === key
    return `<button class="admin-post-item ${active ? 'is-active' : ''}" data-published-index="${index}" type="button"><strong>${escapeHtml(post.title || '未命名文章')}</strong><small>${escapeHtml(post.date || '未设置日期')} · ${escapeHtml(post.category || '随笔')}</small>${draft ? '<span class="admin-post-status">有未发布修改</span>' : ''}</button>`
  }).join('') : '<span class="muted">暂无线上文章</span>'
  draftList.innerHTML = state.drafts.length ? state.drafts.map((post, index) => {
    const active = state.active?.kind === 'draft' && state.active.id === post.id
    return `<button class="admin-post-item ${active ? 'is-active' : ''}" data-draft-index="${index}" type="button"><strong>${escapeHtml(post.title || '未命名文章')}</strong><small>${escapeHtml(post.date || '未设置日期')} · ${escapeHtml(post.category || '随笔')}</small><span class="admin-post-status">${post.sourcePath ? '待发布更新' : '新文章草稿'}</span></button>`
  }).join('') : '<span class="muted">暂无本地草稿</span>'
  publishedList.querySelectorAll('[data-published-index]').forEach(button => button.addEventListener('click', () => {
    const post = state.publishedPosts[Number(button.dataset.publishedIndex)]
    const draft = findDraftFor(post)
    selectPost(draft ? 'draft' : 'published', draft ? draft.id : postKey(post))
  }))
  draftList.querySelectorAll('[data-draft-index]').forEach(button => button.addEventListener('click', () => selectPost('draft', state.drafts[Number(button.dataset.draftIndex)].id)))
}

const selectPost = (kind, id) => {
  state.active = kind === 'draft' ? { kind, id } : { kind, key: id }
  fillForm(getActivePost() || blankPost())
  renderList()
}

const stashDraft = current => {
  current.id = state.active?.kind === 'draft' ? state.active.id : `draft-${Date.now()}`
  const index = state.drafts.findIndex(post => post.id === current.id)
  if (index >= 0) state.drafts[index] = current
  else state.drafts.unshift(current)
  state.active = { kind: 'draft', id: current.id }
  saveDrafts(); renderList(); fillForm(current)
  return current
}

const saveDraft = () => {
  const current = readForm()
  if (!current.title) { showToast('请先填写标题'); return null }
  if (!current.date) { showToast('请设置发布日期'); return null }
  if (current.cover && !coverUrl(current.cover) && !/^qxy-upload:\/\/[0-9a-f-]{36}$/i.test(current.cover)) { showToast('封面地址须为 http(s) 链接、站内路径或已暂存图片'); return null }
  current.slug = current.slug || slugify(current.title)
  stashDraft(current)
  showToast(current.sourcePath ? '修改已保存为本地草稿' : '草稿已保存到本机')
  return current
}

const toBase64 = async blob => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

const referencedMediaIds = post => [...new Set([...`${post.content || ''}\n${post.cover || ''}`.matchAll(/qxy-upload:\/\/([0-9a-f-]{36})/gi)].map(match => match[1]))]

const restoreMediaPreviews = async post => {
  const owner = mediaOwner(post)
  const ids = new Set([...(post.mediaIds || []), ...referencedMediaIds(post)])
  try {
    for (const id of ids) {
      const item = await getDraftMedia(owner, id)
      if (!item || mediaUrls.has(`qxy-upload://${id}`)) continue
      mediaUrls.set(`qxy-upload://${id}`, URL.createObjectURL(item.blob))
    }
    if (state.active?.kind === 'draft' && state.active.id === post.id) updateCoverPreview()
  } catch (error) {
    document.querySelector('#saveStatus').textContent = error.message
  }
}

const stageImageFiles = async (files, target) => {
  const selected = [...files]
  if (!selected.length) return
  const current = readForm()
  current.mediaIds = [...new Set(current.mediaIds || [])]
  const owner = mediaOwner(current)
  const referenced = referencedMediaIds(current)
  const previousCoverId = target === 'cover' ? current.cover.match(/^qxy-upload:\/\/([0-9a-f-]{36})$/i)?.[1] : ''
  const keepIds = previousCoverId && !current.content.includes(`qxy-upload://${previousCoverId}`)
    ? referenced.filter(id => id !== previousCoverId)
    : referenced
  const removedIds = await pruneDraftMedia(owner, keepIds)
  current.mediaIds = current.mediaIds.filter(id => keepIds.includes(id))
  for (const id of removedIds) {
    const token = `qxy-upload://${id}`
    const url = mediaUrls.get(token)
    if (url) URL.revokeObjectURL(url)
    mediaUrls.delete(token)
  }
  const existing = await listDraftMedia(owner)
  if (existing.length + selected.length > MAX_DRAFT_MEDIA_COUNT) throw new Error(`单篇草稿最多暂存 ${MAX_DRAFT_MEDIA_COUNT} 张图片。`)
  let total = existing.reduce((sum, item) => sum + item.size, 0)
  const textarea = document.querySelector('#postContent')
  const stagedTokens = []

  for (const file of selected) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      throw new Error('请选择 3 MB 内的 JPG、PNG、WebP 或 GIF 图片。')
    }
    if (total + file.size > MAX_DRAFT_MEDIA_BYTES) throw new Error('单篇草稿最多暂存 8 MB 图片，请移除不需要的图片后重试。')
    total += file.size
  }

  try {
    for (const file of selected) {
      const id = crypto.randomUUID()
      const token = `qxy-upload://${id}`
      stagedTokens.push({ id, token, name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_') })
      await putDraftMedia(owner, id, file)
      mediaUrls.set(token, URL.createObjectURL(file))
      current.mediaIds.push(id)
    }

    if (target === 'cover') {
      const item = stagedTokens[0]
      current.cover = item.token
      document.querySelector('#postCover').value = item.token
      updateCoverPreview()
    } else {
      const snippets = stagedTokens.map(item => `![${item.name}](${item.token})`).join('\n')
      const start = textarea.selectionStart
      const before = textarea.value.slice(0, start)
      const separator = before && !before.endsWith('\n') ? '\n\n' : ''
      textarea.setRangeText(`${separator}${snippets}\n\n`, start, textarea.selectionEnd, 'end')
      current.content = textarea.value
    }

    const draft = stashDraft(current)
    if (state.draftsPersisted !== false) document.querySelector('#saveStatus').textContent = '图片只保存在此浏览器草稿中；点击“发布”后才会与文章一起提交。'
    showToast(`${stagedTokens.length} 张图片已暂存`)
    return draft
  } catch (error) {
    for (const item of stagedTokens) {
      await deleteDraftMedia(owner, item.id).catch(() => {})
      const url = mediaUrls.get(item.token)
      if (url) URL.revokeObjectURL(url)
      mediaUrls.delete(item.token)
    }
    throw error
  }
}

const publishCurrent = async () => {
  const current = saveDraft()
  if (!current) return
  await state.snapshotWrite
  if (!state.draftsPersisted) {
    showToast('本机草稿备份失败，请先导出 Markdown 后再发布')
    return
  }
  if (!isApiConfigured()) {
    showToast('还没有配置发布后端，请先部署 Cloudflare Pages')
    return
  }
  if (!await checkAuth()) {
    publishLogin()
    return
  }
  const button = document.querySelector('#publishPost')
  button.disabled = true
  button.textContent = current.sourcePath ? '更新中…' : '发布中…'
  document.querySelector('#saveStatus').textContent = '正在提交到 GitHub…'
  try {
    const owner = mediaOwner(current)
    const media = []
    for (const id of referencedMediaIds(current)) {
      const item = await getDraftMedia(owner, id)
      if (!item) throw new Error('草稿引用的图片暂存文件已丢失，请重新选择该图片后再发布。')
      media.push({ id, name: item.name, type: item.type, data: await toBase64(item.blob) })
    }
    const response = await fetch(`${apiBase()}/api/publish`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, media })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '发布失败')
    const resolved = new Map(media.map((item, index) => [`qxy-upload://${item.id}`, data.mediaPaths?.[index] || '']))
    const replaceMedia = value => String(value || '').replace(/qxy-upload:\/\/([0-9a-f-]{36})/gi, token => resolved.get(token) || token)
    const published = { ...current, cover: replaceMedia(current.cover), content: replaceMedia(current.content), mediaIds: [], sourcePath: data.path, date: data.date || current.date, updated: data.updated || current.date }
    state.publishedPosts = [published, ...state.publishedPosts.filter(post => post.sourcePath !== data.path)]
    state.drafts = state.drafts.filter(post => post.id !== current.id)
    state.active = { kind: 'published', key: data.path }
    saveDrafts(); renderList(); fillForm(published)
    await state.snapshotWrite
    const draftSaved = state.draftsPersisted
    const storedMedia = await listDraftMedia(owner).catch(() => [])
    await clearDraftMedia(owner).catch(() => {})
    for (const item of storedMedia) {
      const token = `qxy-upload://${item.id}`
      const url = mediaUrls.get(token)
      if (url) URL.revokeObjectURL(url)
      mediaUrls.delete(token)
    }
    document.querySelector('#saveStatus').textContent = draftSaved
      ? `已提交到 GitHub：${data.path}，Cloudflare 正在部署。`
      : '文章已发布，但浏览器无法更新草稿记录，请重新加载管理台。'
    showToast(current.sourcePath ? '更新已提交，网站正在部署' : '文章已提交，网站正在部署')
  } catch (error) {
    document.querySelector('#saveStatus').textContent = error.message
    showToast(error.message)
  } finally {
    button.disabled = false
    const active = getActivePost()
    button.textContent = active?.sourcePath ? '发布更新' : '发布新文章'
  }
}

const download = (filename, content, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href)
}

const toMarkdown = post => `---\ntitle: ${JSON.stringify(post.title || '')}\ntitleEn: ${JSON.stringify(post.titleEn || '')}\ndate: ${post.date}\nupdated: ${post.updated || post.date}\ncategory: ${JSON.stringify(post.category || '')}\ncategoryEn: ${JSON.stringify(post.categoryEn || '')}\ntags: ${JSON.stringify(post.tags || [])}\ntagsEn: ${JSON.stringify(post.tagsEn || [])}\ncover: ${JSON.stringify(post.cover || '')}\nexcerpt: ${JSON.stringify(post.excerpt || '')}\nexcerptEn: ${JSON.stringify(post.excerptEn || '')}\nslug: ${JSON.stringify(post.slug || '')}\n---\n\n${String(post.content || '').trim()}\n`

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const PREVIEW_KEY = 'qxy-article-preview'
const showPreview = async post => {
  document.querySelector('.preview-overlay')?.remove()
  const overlay = document.createElement('div')
  overlay.className = 'preview-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', '文章预览')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `<iframe class="preview-frame" title="文章预览" src="index.html#preview"></iframe><div class="preview-toolbar"><span>文章预览 · 未发布</span><button class="button button-primary" data-preview-close type="button">返回编辑</button></div>`
  const close = () => {
    overlay.remove()
    sessionStorage.removeItem(PREVIEW_KEY)
    document.removeEventListener('keydown', onKeydown)
    document.querySelector('#previewPost').focus()
  }
  const onKeydown = event => { if (event.key === 'Escape') close() }
  try {
    await restoreMediaPreviews(post)
    const previewContent = String(post.content || '').replace(/qxy-upload:\/\/([0-9a-f-]{36})/gi, token => mediaUrls.get(token) || token)
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify({
      ...post,
      content: previewContent,
      previewCoverUrl: mediaUrls.get(post.cover) || coverPreviews.get(post.cover) || ''
    }))
  } catch {
    showToast('文章过大，无法创建预览')
    return
  }
  document.body.append(overlay)
  overlay.querySelector('iframe').addEventListener('load', event => event.target.contentWindow.addEventListener('keydown', onKeydown))
  overlay.querySelector('[data-preview-close]').addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
}

const parseMarkdown = raw => ({ ...blankPost(), ...parseMarkdownPost(raw, shanghaiToday()) })

const normalizePublished = post => ({
  ...post,
  slug: post.slug || post.id,
  sourcePath: post.sourcePath || `content/posts/${post.date}-${post.slug || post.id}.md`,
  updated: post.updated || post.date,
  tags: Array.isArray(post.tags) ? post.tags : []
})

const samePostContent = (left, right) => ['title', 'date', 'category', 'cover', 'excerpt', 'content'].every(key => (left[key] || '') === (right[key] || ''))
  && JSON.stringify(left.tags || []) === JSON.stringify(right.tags || [])

const restoreDrafts = stored => {
  if (!Array.isArray(stored)) return []
  const drafts = []
  stored.forEach((saved, index) => {
    if (!saved || typeof saved !== 'object') return
    const exact = state.publishedPosts.find(post => saved.sourcePath && saved.sourcePath === post.sourcePath)
    const slugMatches = saved.slug ? state.publishedPosts.filter(post => saved.slug === post.slug) : []
    const published = exact || slugMatches.find(post => saved.date === post.date) || (slugMatches.length === 1 ? slugMatches[0] : null)
    const draft = { ...saved }
    if (published) {
      draft.sourcePath = published.sourcePath
      draft.date = published.date
    }
    if (published && samePostContent(draft, published)) return
    if (!String(draft.id || '').startsWith('draft-')) draft.id = `draft-${Date.now()}-${index}`
    if (!draft.id) draft.id = `draft-${Date.now()}-${index}`
    drafts.push(draft)
  })
  return drafts
}

const init = async () => {
  setTheme(state.theme)
  try { state.site = await (await fetch('content/site.json')).json() } catch { state.site = {} }
  try {
    const response = await fetch('content/posts.json', { cache: 'no-store' })
    if (response.ok) state.publishedPosts = (await response.json()).map(normalizePublished)
  } catch { state.publishedPosts = [] }
  let localSnapshot = null
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(parsed)) localSnapshot = { savedAt: 0, drafts: parsed }
    else if (Array.isArray(parsed?.drafts)) localSnapshot = parsed
  } catch {}
  let indexedSnapshot = null
  try { indexedSnapshot = await getDraftSnapshot() } catch {}
  const snapshots = [localSnapshot, indexedSnapshot].filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  const stored = snapshots[0]?.drafts || null
  state.draftsPersisted = Boolean(localSnapshot || indexedSnapshot)
  if (!localSnapshot && indexedSnapshot) document.querySelector('#saveStatus').textContent = '已从本机 IndexedDB 恢复草稿。'
  else if (localSnapshot && indexedSnapshot && (indexedSnapshot.savedAt || 0) > (localSnapshot.savedAt || 0)) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(indexedSnapshot)) } catch {}
    document.querySelector('#saveStatus').textContent = '已从较新的 IndexedDB 备份恢复草稿。'
  } else if (!localSnapshot && !indexedSnapshot) {
    try { if (localStorage.getItem(STORAGE_KEY)) document.querySelector('#saveStatus').textContent = '无法读取本地草稿。浏览器存储可能已损坏，请先导入或导出备份。' } catch {}
  }
  state.drafts = restoreDrafts(stored)
  if (state.drafts.length) selectPost('draft', state.drafts[0].id)
  else if (state.publishedPosts.length) selectPost('published', postKey(state.publishedPosts[0]))
  else {
    const post = blankPost()
    state.drafts.push(post)
    state.active = { kind: 'draft', id: post.id }
    fillForm(post); renderList()
  }

  document.querySelector('#adminTheme').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'))
  document.querySelector('#newPost').addEventListener('click', () => {
    const post = blankPost()
    state.drafts.unshift(post)
    state.active = { kind: 'draft', id: post.id }
    saveDrafts(); fillForm(post); renderList()
  })
  document.querySelector('#postCover').addEventListener('input', updateCoverPreview)
  document.querySelector('#postCategory').addEventListener('input', updateCoverPreview)
  document.querySelector('#removeCover').addEventListener('click', async () => {
    const current = readForm()
    const owner = mediaOwner(current)
    const stagedId = current.cover.match(/^qxy-upload:\/\/([0-9a-f-]{36})$/i)?.[1]
    if (stagedId && !current.content.includes(`qxy-upload://${stagedId}`)) {
      await deleteDraftMedia(owner, stagedId).catch(() => {})
      current.mediaIds = (current.mediaIds || []).filter(id => id !== stagedId)
      const token = `qxy-upload://${stagedId}`
      const url = mediaUrls.get(token)
      if (url) URL.revokeObjectURL(url)
      mediaUrls.delete(token)
    }
    document.querySelector('#postCover').value = ''
    current.cover = ''
    if (state.active?.kind === 'draft' || current.title) stashDraft(current)
    updateCoverPreview()
  })
  document.querySelector('#uploadCover').addEventListener('click', () => document.querySelector('#coverFile').click())
  document.querySelector('#coverFile').addEventListener('change', async event => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    const button = document.querySelector('#uploadCover')
    button.disabled = true
    button.textContent = '暂存中…'
    try { await stageImageFiles(files.slice(0, 1), 'cover') }
    catch (error) { showToast(error.message || '图片暂存失败') }
    finally { button.disabled = false; button.textContent = '选择封面图片' }
  })
  document.querySelector('#uploadBodyImage').addEventListener('click', () => document.querySelector('#bodyImageFiles').click())
  document.querySelector('#bodyImageFiles').addEventListener('change', async event => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    const button = document.querySelector('#uploadBodyImage')
    button.disabled = true
    button.textContent = '暂存中…'
    try { await stageImageFiles(files, 'body') }
    catch (error) { showToast(error.message || '图片暂存失败') }
    finally { button.disabled = false; button.textContent = '插入图片' }
  })
  document.querySelector('#savePost').addEventListener('click', saveDraft)
  document.querySelector('#publishPost').addEventListener('click', publishCurrent)
  document.querySelector('#loginGithub').addEventListener('click', publishLogin)
  document.querySelector('#deletePost').addEventListener('click', async () => {
    if (state.active?.kind !== 'draft') return
    const owner = mediaOwner(getActivePost())
    state.drafts = state.drafts.filter(post => post.id !== state.active.id)
    saveDrafts()
    await state.snapshotWrite
    const storedMedia = await listDraftMedia(owner).catch(() => [])
    await clearDraftMedia(owner).catch(error => showToast(error.message))
    for (const item of storedMedia) {
      const token = `qxy-upload://${item.id}`
      const url = mediaUrls.get(token)
      if (url) URL.revokeObjectURL(url)
      mediaUrls.delete(token)
    }
    if (state.drafts.length) selectPost('draft', state.drafts[0].id)
    else if (state.publishedPosts.length) selectPost('published', postKey(state.publishedPosts[0]))
    else { state.active = null; fillForm(blankPost()); renderList() }
    showToast('本地草稿已删除')
  })
  document.querySelector('#previewPost').addEventListener('click', () => { const current = readForm(); if (!current.title) { showToast('请先填写标题'); return }; showPreview(current) })
  document.querySelector('#exportCurrent').addEventListener('click', () => {
    const current = readForm()
    if (!current.title) { showToast('请先填写标题'); return }
    current.slug = current.slug || slugify(current.title)
    download(`${current.slug}.md`, toMarkdown(current), 'text/markdown;charset=utf-8')
  })
  document.querySelector('#importMarkdown').addEventListener('click', () => document.querySelector('#markdownFile').click())
  document.querySelector('#importUpdateMarkdown').addEventListener('click', () => document.querySelector('#updateMarkdownFile').click())
  document.querySelector('#updateMarkdownFile').addEventListener('change', async event => {
    const file = event.target.files[0]
    if (!file) return
    try {
      const current = getActivePost()
      if (!current?.sourcePath) throw new Error('请先从“已发布”列表选择要更新的文章。')
      const imported = parseMarkdown(await file.text())
      if (!imported.title.trim() || !imported.content.trim()) throw new Error('Markdown 文件需要包含标题和正文。')
      const updated = {
        ...current,
        ...imported,
        id: state.active.kind === 'draft' ? current.id : `draft-${Date.now()}`,
        slug: current.slug || imported.slug || slugify(imported.title),
        sourcePath: current.sourcePath,
        date: current.date,
        updated: current.updated || current.date,
        category: imported.category || current.category || '随笔',
        tags: imported.tags?.length ? imported.tags : current.tags || [],
        excerpt: imported.excerpt || current.excerpt || '',
        titleEn: imported.titleEn || current.titleEn || '',
        categoryEn: imported.categoryEn || current.categoryEn || '',
        tagsEn: imported.tagsEn?.length ? imported.tagsEn : current.tagsEn || [],
        cover: imported.cover || current.cover || '',
        excerptEn: imported.excerptEn || current.excerptEn || ''
      }
      const index = state.drafts.findIndex(draft => draft.id === updated.id)
      if (index >= 0) state.drafts[index] = updated
      else state.drafts.unshift(updated)
      state.active = { kind: 'draft', id: updated.id }
      fillForm(updated); saveDrafts(); renderList()
      document.querySelector('#saveStatus').textContent = 'Markdown 已导入本地；发布日期和文章链接保持不变。点击“发布更新”同步线上。'
      showToast('Markdown 已导入为待发布更新')
    } catch (error) {
      showToast(error.message || 'Markdown 导入失败')
    } finally {
      event.target.value = ''
    }
  })
  document.querySelector('#markdownFile').addEventListener('change', async event => {
    const file = event.target.files[0]
    if (!file) return
    const post = parseMarkdown(await file.text())
    post.id = `draft-${Date.now()}`
    state.drafts.unshift(post); state.active = { kind: 'draft', id: post.id }
    fillForm(post); saveDrafts(); renderList(); showToast('Markdown 已导入本机')
    event.target.value = ''
  })
  const params = new URLSearchParams(location.search)
  if (params.get('auth') === 'success') showToast('GitHub 登录成功')
  if (params.get('auth') === 'error') {
    const reason = params.get('reason') || 'unknown'
    const message = authErrorMessage(reason)
    document.querySelector('#saveStatus').textContent = message
    showToast(message)
    console.error('GitHub OAuth failure category:', reason)
  }
  if (params.has('auth') || params.has('reason')) {
    params.delete('auth')
    params.delete('reason')
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`)
  }
  await checkAuth()
}

init()
