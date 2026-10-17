const STORAGE_KEY = 'qxy-drafts'
const html = document.documentElement
const toast = document.querySelector('#toast')
const state = { posts: [], active: null, theme: localStorage.getItem('qxy-theme') || 'light', site: null, authenticated: false }

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

const saveDrafts = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts))
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

const blankPost = () => ({ id: `draft-${Date.now()}`, slug: '', title: '', date: new Date().toISOString().slice(0, 10), category: '随笔', tags: [], excerpt: '', content: '' })
const authErrorMessage = reason => ({
  oauth_denied: 'GitHub 拒绝了本次授权。请重新登录并完成授权。',
  state_cookie_missing: '浏览器没有带回 OAuth 临时 Cookie。请确认登录和回调都使用 personal-website-8cn.pages.dev 域名。',
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

const readForm = () => ({
  ...state.posts.find(post => post.id === state.active),
  title: document.querySelector('#postTitle').value.trim(),
  date: document.querySelector('#postDate').value,
  category: document.querySelector('#postCategory').value.trim() || '随笔',
  tags: document.querySelector('#postTags').value.split(',').map(item => item.trim()).filter(Boolean),
  excerpt: document.querySelector('#postExcerpt').value.trim(),
  content: document.querySelector('#postContent').value
})

const fillForm = post => {
  document.querySelector('#editorTitle').textContent = post.title || '新文章'
  document.querySelector('#postTitle').value = post.title || ''
  document.querySelector('#postDate').value = post.date || new Date().toISOString().slice(0, 10)
  document.querySelector('#postCategory').value = post.category || '随笔'
  document.querySelector('#postTags').value = (post.tags || []).join(', ')
  document.querySelector('#postExcerpt').value = post.excerpt || ''
  document.querySelector('#postContent').value = post.content || ''
}

const renderList = () => {
  const list = document.querySelector('#adminPostList')
  list.innerHTML = state.posts.length ? state.posts.map(post => `<button class="admin-post-item ${post.id === state.active ? 'is-active' : ''}" data-post-id="${post.id}" type="button"><strong>${post.title || '未命名文章'}</strong><small>${post.date || '未设置日期'} · ${post.category || '随笔'}</small></button>`).join('') : '<span class="muted">还没有本地草稿</span>'
  list.querySelectorAll('[data-post-id]').forEach(button => button.addEventListener('click', () => selectPost(button.dataset.postId)))
}

const selectPost = id => {
  state.active = id
  fillForm(state.posts.find(post => post.id === id) || blankPost())
  renderList()
}

const upsertCurrent = () => {
  const current = readForm()
  if (!current.title) { showToast('请先填写标题'); return null }
  current.slug = current.slug || slugify(current.title)
  const index = state.posts.findIndex(post => post.id === state.active)
  if (index >= 0) state.posts[index] = current
  else state.posts.unshift(current)
  state.active = current.id
  saveDrafts(); renderList(); fillForm(current)
  document.querySelector('#saveStatus').textContent = `已保存到本机：${new Date().toLocaleTimeString()}`
  showToast('草稿已保存')
  return current
}

const publishCurrent = async () => {
  const current = upsertCurrent()
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
  button.textContent = '发布中…'
  document.querySelector('#saveStatus').textContent = '正在提交到 GitHub…'
  try {
    const response = await fetch(`${apiBase()}/api/publish`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '发布失败')
    document.querySelector('#saveStatus').textContent = `已提交到 GitHub：${data.path}`
    showToast('发布成功，网站会自动部署')
  } catch (error) {
    document.querySelector('#saveStatus').textContent = error.message
    showToast(error.message)
  } finally {
    button.disabled = false
    button.textContent = '发布到网站'
  }
}

const download = (filename, content, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href)
}

const toMarkdown = post => `---\ntitle: ${post.title}\ndate: ${post.date}\ncategory: ${post.category}\ntags: [${post.tags.join(', ')}]\ncover: /assets/cover.webp\nexcerpt: ${post.excerpt}\n---\n\n${post.content.trim()}\n`

const parseMarkdown = raw => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { ...blankPost(), content: raw }
  const meta = {}
  match[1].split(/\r?\n/).forEach(line => { const index = line.indexOf(':'); if (index >= 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim() })
  const tags = (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean)
  return { ...blankPost(), title: meta.title || '', date: meta.date || new Date().toISOString().slice(0, 10), category: meta.category || '随笔', tags, excerpt: meta.excerpt || '', content: match[2].trim() }
}

const init = async () => {
  setTheme(state.theme)
  try { state.site = await (await fetch('content/site.json')).json() } catch { state.site = {} }
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  if (Array.isArray(stored) && stored.length) state.posts = stored
  else {
    try { state.posts = await (await fetch('content/posts.json')).json() } catch { state.posts = [] }
  }
  const first = state.posts[0] || blankPost()
  if (!state.posts.length) state.posts.push(first)
  state.active = first.id
  fillForm(first); renderList()

  document.querySelector('#adminTheme').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'))
  document.querySelector('#newPost').addEventListener('click', () => { const post = blankPost(); state.posts.unshift(post); state.active = post.id; fillForm(post); renderList() })
  document.querySelector('#savePost').addEventListener('click', upsertCurrent)
  document.querySelector('#publishPost').addEventListener('click', publishCurrent)
  document.querySelector('#loginGithub').addEventListener('click', publishLogin)
  document.querySelector('#deletePost').addEventListener('click', () => { if (!state.active) return; state.posts = state.posts.filter(post => post.id !== state.active); const next = state.posts[0] || blankPost(); if (!state.posts.length) state.posts.push(next); state.active = next.id; fillForm(next); saveDrafts(); renderList(); showToast('草稿已删除') })
  document.querySelector('#previewPost').addEventListener('click', () => { const current = readForm(); const preview = new Blob([toMarkdown(current)], { type: 'text/markdown;charset=utf-8' }); window.open(URL.createObjectURL(preview), '_blank') })
  document.querySelector('#exportAll').addEventListener('click', () => { const current = upsertCurrent(); if (current) download(`${current.slug}.md`, toMarkdown(current), 'text/markdown;charset=utf-8') })
  document.querySelector('#importMarkdown').addEventListener('click', () => document.querySelector('#markdownFile').click())
  document.querySelector('#markdownFile').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; const post = parseMarkdown(await file.text()); post.id = `draft-${Date.now()}`; state.posts.unshift(post); state.active = post.id; fillForm(post); saveDrafts(); renderList(); showToast('Markdown 已导入本机') })
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
