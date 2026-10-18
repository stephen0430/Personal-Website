const STORAGE_KEY = 'qxy-drafts'
const html = document.documentElement
const toast = document.querySelector('#toast')
const state = { publishedPosts: [], drafts: [], active: null, theme: localStorage.getItem('qxy-theme') || 'light', site: null, authenticated: false }

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
  localStorage.setItem('qxy-theme', theme)
  document.querySelector('#adminTheme').textContent = theme === 'dark' ? '☼' : '☾'
}

const saveDrafts = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.drafts))
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

const blankPost = () => ({ id: `draft-${Date.now()}`, slug: '', title: '', date: shanghaiToday(), updated: '', category: '随笔', tags: [], excerpt: '', content: '' })
const previewDate = date => {
  const [year, month, day] = String(date || '').split('-')
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : ''
}
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
const getActivePost = () => {
  if (!state.active) return null
  return state.active.kind === 'draft'
    ? state.drafts.find(post => post.id === state.active.id) || null
    : state.publishedPosts.find(post => postKey(post) === state.active.key) || null
}
const findDraftFor = post => state.drafts.find(draft => draft.sourcePath && draft.sourcePath === post.sourcePath)

const readForm = () => {
  const base = getActivePost() || blankPost()
  return {
    ...base,
    title: document.querySelector('#postTitle').value.trim(),
    date: base.sourcePath ? base.date : document.querySelector('#postDate').value,
    category: document.querySelector('#postCategory').value.trim() || '随笔',
    tags: document.querySelector('#postTags').value.split(',').map(item => item.trim()).filter(Boolean),
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
  document.querySelector('#postTags').value = (post.tags || []).join(', ')
  document.querySelector('#postExcerpt').value = post.excerpt || ''
  document.querySelector('#postContent').value = post.content || ''
  document.querySelector('#savePost').textContent = isPublished ? '保存本地修改' : '保存草稿'
  document.querySelector('#publishPost').textContent = isPublished ? '发布更新' : '发布新文章'
  document.querySelector('#deletePost').hidden = !isDraft
  document.querySelector('#deletePost').disabled = !isDraft
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

const saveDraft = () => {
  const current = readForm()
  if (!current.title) { showToast('请先填写标题'); return null }
  if (!current.date) { showToast('请设置发布日期'); return null }
  current.slug = current.slug || slugify(current.title)
  current.id = state.active?.kind === 'draft' ? state.active.id : `draft-${Date.now()}`
  const index = state.drafts.findIndex(post => post.id === current.id)
  if (index >= 0) state.drafts[index] = current
  else state.drafts.unshift(current)
  state.active = { kind: 'draft', id: current.id }
  saveDrafts(); renderList(); fillForm(current)
  document.querySelector('#saveStatus').textContent = `已保存到当前浏览器：${new Date().toLocaleTimeString()}`
  showToast(current.sourcePath ? '修改已保存为本地草稿' : '草稿已保存到本机')
  return current
}

const publishCurrent = async () => {
  const current = saveDraft()
  if (!current) return
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
    const response = await fetch(`${apiBase()}/api/publish`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '发布失败')
    const published = { ...current, sourcePath: data.path, date: data.date || current.date, updated: data.updated || current.date }
    state.publishedPosts = [published, ...state.publishedPosts.filter(post => post.sourcePath !== data.path)]
    state.drafts = state.drafts.filter(post => post.id !== current.id)
    state.active = { kind: 'published', key: data.path }
    saveDrafts(); renderList(); fillForm(published)
    document.querySelector('#saveStatus').textContent = `已提交到 GitHub：${data.path}，Cloudflare 正在部署。`
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

const toMarkdown = post => `---\ntitle: ${post.title}\ntitleEn: ${post.titleEn || ''}\ndate: ${post.date}\nupdated: ${post.updated || post.date}\ncategory: ${post.category}\ncategoryEn: ${post.categoryEn || ''}\ntags: [${(post.tags || []).join(', ')}]\ntagsEn: [${(post.tagsEn || []).join(', ')}]\ncover: ${post.cover || '/assets/cover.webp'}\nexcerpt: ${post.excerpt || ''}\nexcerptEn: ${post.excerptEn || ''}\nslug: ${post.slug || ''}\n---\n\n${String(post.content || '').trim()}\n`

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const renderPreviewMarkdown = markdown => {
  const codeBlocks = []
  const source = String(markdown || '').replace(/```(\w*)\n([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.push({ language: language || 'text', code: code.trimEnd() }) - 1
    return `\n@@CODE_${index}@@\n`
  })
  const inline = value => escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const output = []
  let paragraph = []
  const flush = () => { if (paragraph.length) { output.push(`<p>${paragraph.map(inline).join('<br />')}</p>`); paragraph = [] } }
  for (const line of source.split(/\r?\n/)) {
    const text = line.trim()
    const code = text.match(/^@@CODE_(\d+)@@$/)
    if (code) {
      flush()
      const block = codeBlocks[Number(code[1])]
      output.push(`<div class="code-block"><div class="code-label">${escapeHtml(block.language)}</div><pre>${escapeHtml(block.code)}</pre></div>`)
      continue
    }
    if (!text) { flush(); continue }
    const heading = text.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      flush()
      const level = heading[1].length
      const title = heading[2].replace(/[*_`]/g, '')
      output.push(`<h${level}>${inline(title)}</h${level}>`)
      continue
    }
    const item = text.match(/^[-*]\s+(.+)$/)
    if (item) {
      flush()
      const previous = output[output.length - 1]
      if (!previous || !previous.endsWith('</ul>')) output.push('<ul>')
      output.push(`<li>${inline(item[1])}</li>`)
      continue
    }
    paragraph.push(text)
  }
  flush()
  const html = output.join('').replace(/(<ul>(?:<li>[\s\S]*?<\/li>)+)(?=<|$)/g, '$1</ul>')
  return html
}

const showPreview = post => {
  document.querySelector('.preview-overlay')?.remove()
  const headings = [...String(post.content || '').matchAll(/^#{2,4}\s+(.+)$/gm)].map(match => match[1].replace(/[*_`]/g, ''))
  const overlay = document.createElement('div')
  overlay.className = 'preview-overlay'
  const updated = post.updated || post.date
  overlay.innerHTML = `<div class="preview-toolbar"><span>文章预览</span><button class="icon-button" data-preview-close type="button" aria-label="关闭预览">×</button></div><div class="preview-page"><header class="preview-hero" style="background-image:url('/assets/hero.webp')"><div><span class="eyebrow">QXY WEB</span><h1>${escapeHtml(post.title || '未命名文章')}</h1><p>发表于：${escapeHtml(previewDate(post.date))} · 更新于：${escapeHtml(previewDate(updated))}</p></div></header><div class="preview-layout"><article class="article-card"><div class="article-cover"><img src="/assets/cover.webp" alt="${escapeHtml(post.title)}" /></div><div class="article-content"><header class="article-header"><span class="eyebrow">${escapeHtml(post.category || '随笔')}</span><h1>${escapeHtml(post.title || '未命名文章')}</h1><p>${(post.tags || []).map(escapeHtml).join(' / ')}</p></header><div class="article-body">${renderPreviewMarkdown(post.content)}</div><div class="article-footer"><span>QXY Web · Xinyan Qin</span><span>预览模式</span></div></div></article><aside class="toc-card"><h3>目录</h3>${headings.length ? headings.map((heading, index) => `<a href="#">${index + 1}. ${escapeHtml(heading)}</a>`).join('') : '<span class="muted">暂无标题</span>'}</aside></div></div>`
  document.body.append(overlay)
  overlay.querySelector('[data-preview-close]').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove() })
}

const parseMarkdown = raw => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { ...blankPost(), content: raw }
  const meta = {}
  match[1].split(/\r?\n/).forEach(line => { const index = line.indexOf(':'); if (index >= 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim() })
  const parseTags = value => (value || '').replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean)
  return { ...blankPost(), slug: meta.slug || '', title: meta.title || '', titleEn: meta.titleEn || '', date: meta.date || shanghaiToday(), updated: meta.updated || '', category: meta.category || '随笔', categoryEn: meta.categoryEn || '', tags: parseTags(meta.tags), tagsEn: parseTags(meta.tagsEn), cover: meta.cover || '/assets/cover.webp', excerpt: meta.excerpt || '', excerptEn: meta.excerptEn || '', content: match[2].trim() }
}

const normalizePublished = post => ({
  ...post,
  slug: post.slug || post.id,
  sourcePath: post.sourcePath || `content/posts/${post.date}-${post.slug || post.id}.md`,
  updated: post.updated || post.date,
  tags: Array.isArray(post.tags) ? post.tags : []
})

const samePostContent = (left, right) => ['title', 'date', 'category', 'excerpt', 'content'].every(key => (left[key] || '') === (right[key] || ''))
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
  let stored = null
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { stored = null }
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
  document.querySelector('#savePost').addEventListener('click', saveDraft)
  document.querySelector('#publishPost').addEventListener('click', publishCurrent)
  document.querySelector('#loginGithub').addEventListener('click', publishLogin)
  document.querySelector('#deletePost').addEventListener('click', () => {
    if (state.active?.kind !== 'draft') return
    state.drafts = state.drafts.filter(post => post.id !== state.active.id)
    saveDrafts()
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
