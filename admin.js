const STORAGE_KEY = 'qxy-drafts'
const html = document.documentElement
const toast = document.querySelector('#toast')
const state = { posts: [], active: null, theme: localStorage.getItem('qxy-theme') || 'light' }

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

const blankPost = () => ({ id: `draft-${Date.now()}`, slug: '', title: '', date: new Date().toISOString().slice(0, 10), category: '随笔', tags: [], excerpt: '', content: '' })

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
  document.querySelector('#deletePost').addEventListener('click', () => { if (!state.active) return; state.posts = state.posts.filter(post => post.id !== state.active); const next = state.posts[0] || blankPost(); if (!state.posts.length) state.posts.push(next); state.active = next.id; fillForm(next); saveDrafts(); renderList(); showToast('草稿已删除') })
  document.querySelector('#previewPost').addEventListener('click', () => { const current = readForm(); const preview = new Blob([toMarkdown(current)], { type: 'text/markdown;charset=utf-8' }); window.open(URL.createObjectURL(preview), '_blank') })
  document.querySelector('#exportAll').addEventListener('click', () => { const current = upsertCurrent(); if (current) download(`${current.slug}.md`, toMarkdown(current), 'text/markdown;charset=utf-8') })
  document.querySelector('#importMarkdown').addEventListener('click', () => document.querySelector('#markdownFile').click())
  document.querySelector('#markdownFile').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; const post = parseMarkdown(await file.text()); post.id = `draft-${Date.now()}`; state.posts.unshift(post); state.active = post.id; fillForm(post); saveDrafts(); renderList(); showToast('Markdown 已导入本机') })
}

init()
