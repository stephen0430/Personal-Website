const state = {
  site: null,
  posts: [],
  lang: localStorage.getItem('qxy-lang') || 'zh',
  theme: localStorage.getItem('qxy-theme') || 'light'
}

const basePath = location.hostname.endsWith('.github.io')
  ? `/${location.pathname.split('/').filter(Boolean)[0] || ''}`
  : ''
const assetUrl = value => String(value || '').startsWith('/') ? `${basePath}${value}` : value

const app = document.querySelector('#app')
const html = document.documentElement
const toast = document.querySelector('#toast')

const dictionary = {
  zh: {
    'nav.home': '首页', 'nav.archive': '归档', 'nav.categories': '分类', 'nav.tags': '标签', 'nav.about': '关于',
    'search.title': '搜索文章', 'search.placeholder': '输入标题、标签或关键词', 'home.latest': '最近更新',
    'home.latestDesc': '把正在学习的东西，认真留下来。', 'home.all': '查看全部', 'home.archive': '时间轴',
    'home.profile': '关于我', 'home.categories': '分类', 'home.tags': '常用标签', 'home.stats': '网站信息',
    'home.posts': '文章', 'home.words': '总字数', 'home.views': '访问量', 'home.rss': 'RSS', 'home.sitemap': '站点地图', 'home.admin': '管理台', 'home.subscribe': '订阅', 'home.view': '查看', 'home.manage': '管理', 'article.back': '返回首页',
    'article.comments': '评论', 'article.commentsHint': '评论区已预留，配置 Giscus 后即可启用。',
    'article.toc': '目录', 'article.copy': '复制', 'article.copied': '已复制', 'about.title': '关于 QXY Web',
    'about.label': 'ABOUT', 'friends.title': '友链', 'archive.title': '时间轴', 'categories.title': '分类',
    'tags.title': '标签', 'empty': '这里还没有内容。'
  },
  en: {
    'nav.home': 'Home', 'nav.archive': 'Archive', 'nav.categories': 'Categories', 'nav.tags': 'Tags', 'nav.about': 'About',
    'search.title': 'Search posts', 'search.placeholder': 'Search title, tag or keyword', 'home.latest': 'Latest notes',
    'home.latestDesc': 'Keeping the things I am learning, one note at a time.', 'home.all': 'View all', 'home.archive': 'Timeline',
    'home.profile': 'About me', 'home.categories': 'Categories', 'home.tags': 'Common tags', 'home.stats': 'Site info',
    'home.posts': 'Posts', 'home.words': 'Words', 'home.views': 'Visits', 'home.rss': 'RSS', 'home.sitemap': 'Sitemap', 'home.admin': 'Admin', 'home.subscribe': 'Subscribe', 'home.view': 'View', 'home.manage': 'Manage', 'article.back': 'Back home',
    'article.comments': 'Comments', 'article.commentsHint': 'The comment area is ready for Giscus configuration.',
    'article.toc': 'On this page', 'article.copy': 'Copy', 'article.copied': 'Copied', 'about.title': 'About QXY Web',
    'about.label': 'ABOUT', 'friends.title': 'Links', 'archive.title': 'Timeline', 'categories.title': 'Categories',
    'tags.title': 'Tags', 'empty': 'Nothing here yet.'
  }
}

const t = key => dictionary[state.lang][key] || key
const localized = (item, key) => state.lang === 'en' && item?.[`${key}En`] ? item[`${key}En`] : item?.[key]
const localizedSite = key => {
  const englishKey = `english${key[0].toUpperCase()}${key.slice(1)}`
  return state.lang === 'en' && state.site?.[englishKey] ? state.site[englishKey] : state.site?.[key]
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const safeUrl = value => /^(https?:\/\/|\/|#)/i.test(value) ? value : '#'

const inlineMarkdown = value => {
  let text = escapeHtml(value)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" />`)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noreferrer">${label}</a>`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return text
}

const renderMarkdown = markdown => {
  const codeBlocks = []
  const source = String(markdown || '').replace(/```(\w*)\n([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.push({ language: language || 'text', code: code.trimEnd() }) - 1
    return `\n@@CODE_${index}@@\n`
  })
  const lines = source.split(/\r?\n/)
  const output = []
  let paragraph = []
  let listType = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    output.push(`<p>${paragraph.map(inlineMarkdown).join('<br />')}</p>`)
    paragraph = []
  }
  const closeList = () => {
    if (listType) output.push(`</${listType}>`)
    listType = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const codeMatch = trimmed.match(/^@@CODE_(\d+)@@$/)
    if (codeMatch) {
      flushParagraph(); closeList()
      const block = codeBlocks[Number(codeMatch[1])]
      output.push(`<div class="code-block"><div class="code-label">${escapeHtml(block.language)}</div><button class="code-copy" data-copy-code type="button">${t('article.copy')}</button><pre>${escapeHtml(block.code)}</pre></div>`)
      continue
    }
    if (!trimmed) { flushParagraph(); closeList(); continue }
    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      flushParagraph(); closeList()
      const level = heading[1].length
      const text = heading[2].replace(/[*_`]/g, '')
      const id = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || `section-${output.length}`
      output.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`)
      continue
    }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/)
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const nextType = unordered ? 'ul' : 'ol'
      if (listType !== nextType) { closeList(); output.push(`<${nextType}>`); listType = nextType }
      output.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`)
      continue
    }
    if (trimmed.startsWith('> ')) {
      flushParagraph(); closeList(); output.push(`<blockquote>${inlineMarkdown(trimmed.slice(2))}</blockquote>`); continue
    }
    paragraph.push(trimmed)
  }
  flushParagraph(); closeList()
  return output.join('')
}

const formatDate = date => new Intl.DateTimeFormat(state.lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`))
const wordCount = post => post.content.replace(/[`#>*_\-\[\]()]/g, '').replace(/\s/g, '').length
const sortedPosts = () => [...state.posts].sort((a, b) => b.date.localeCompare(a.date))
const countBy = key => state.posts.reduce((map, post) => {
  const value = post[key]
  if (Array.isArray(value)) value.forEach(item => { map[item] = (map[item] || 0) + 1 })
  else map[value] = (map[value] || 0) + 1
  return map
}, {})

const setTheme = theme => {
  state.theme = theme
  html.dataset.theme = theme
  localStorage.setItem('qxy-theme', theme)
  document.querySelector('#themeButton').textContent = theme === 'dark' ? '☼' : '☾'
  document.querySelector('#adminTheme')?.replaceChildren(document.createTextNode(theme === 'dark' ? '☼' : '☾'))
}

const showToast = message => {
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 1800)
}

const renderHeaderText = () => {
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n) })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder) })
  const languageButton = document.querySelector('#languageButton')
  languageButton.textContent = state.lang === 'zh' ? 'EN' : '中'
  languageButton.title = state.lang === 'zh' ? 'Switch to English' : '切换到中文'
}

const renderHero = () => `
  <section class="hero" id="home-hero" style="--hero-image: url('${assetUrl(state.site.hero)}')">
    <div class="hero-content">
      <h1>${escapeHtml(state.site.name)}</h1>
      <p class="hero-subtitle">${escapeHtml(state.lang === 'zh' ? state.site.subtitle : state.site.englishSubtitle)}</p>
      <div class="hero-meta">
        <span>${escapeHtml(localizedSite('profession'))}</span>
        <span>${escapeHtml(localizedSite('research'))}</span>
      </div>
      <div class="hero-socials">${state.site.links.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('')}</div>
    </div>
    <a class="hero-scroll" href="#latest" aria-label="Scroll down">⌄</a>
  </section>`

const renderProfile = () => {
  const visits = Number(localStorage.getItem('qxy-visits') || 0)
  return `<div class="side-card profile-card">
    <img src="${safeUrl(assetUrl(state.site.avatar))}" alt="${escapeHtml(state.site.displayName)}" />
    <h3>${escapeHtml(state.site.displayName)}</h3>
    <p>${escapeHtml(localizedSite('bio'))}</p>
    <div class="profile-links">${state.site.links.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('')}</div>
    <div class="stat-grid"><div><strong>${state.posts.length}</strong><span>${t('home.posts')}</span></div><div><strong>${Math.round(state.posts.reduce((sum, post) => sum + wordCount(post), 0) / 1000 * 10) / 10}k</strong><span>${t('home.words')}</span></div><div><strong>${visits}</strong><span>${t('home.views')}</span></div></div>
  </div>`
}

const renderSidebar = () => {
  const categories = countBy('category')
  const tags = countBy('tags')
  return `<aside class="sidebar">${renderProfile()}
    <div class="side-card"><h3>${t('home.categories')}</h3><ul class="side-list">${Object.entries(categories).map(([name, count]) => `<li><a href="#category/${encodeURIComponent(name)}">${escapeHtml(name)}<small>${count}</small></a></li>`).join('')}</ul></div>
    <div class="side-card"><h3>${t('home.tags')}</h3><div class="side-tag-cloud">${Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0, 12).map(([name, count]) => `<a class="tag-chip" href="#tag/${encodeURIComponent(name)}">${escapeHtml(name)} ${count}</a>`).join('')}</div></div>
    <div class="side-card"><h3>${t('home.stats')}</h3><ul class="side-list"><li><span>RSS</span><a href="rss.xml">${t('home.subscribe')}</a></li><li><span>Sitemap</span><a href="sitemap.xml">${t('home.view')}</a></li><li><span>Admin</span><a href="admin.html">${t('home.manage')}</a></li></ul></div>
  </aside>`
}

const renderPostCard = post => `<article class="post-card">
  <a class="post-cover" href="#post/${encodeURIComponent(post.slug)}"><img src="${safeUrl(assetUrl(post.cover || state.site.defaultCover))}" alt="${escapeHtml(localized(post, 'title') || post.title)}" loading="lazy" /></a>
  <div class="post-info"><div class="post-meta"><time>${formatDate(post.date)}</time><span>·</span><a href="#category/${encodeURIComponent(post.category)}">${escapeHtml(localized(post, 'category') || post.category)}</a></div><h3><a href="#post/${encodeURIComponent(post.slug)}">${escapeHtml(localized(post, 'title') || post.title)}</a></h3><p>${escapeHtml(localized(post, 'excerpt') || post.excerpt)}</p><div class="post-tags">${post.tags.map(tag => `<a class="tag-chip" href="#tag/${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`).join('')}</div></div>
</article>`

const renderHome = () => `${renderHero()}<section class="page-section" id="latest"><div class="section-heading"><div><span class="eyebrow">QXY NOTES</span><h2>${t('home.latest')}</h2></div><div><p>${t('home.latestDesc')}</p><a class="section-link" href="#archive">${t('home.all')} →</a></div></div><div class="home-layout"><div class="post-grid">${sortedPosts().map(renderPostCard).join('')}</div>${renderSidebar()}</div></section>`

const renderPageBanner = (label, title) => `<section class="page-banner" style="--hero-image: url('${assetUrl(state.site.hero)}')"><div class="page-banner-inner"><span class="eyebrow">${escapeHtml(label)}</span><h1>${escapeHtml(title)}</h1></div></section>`

const renderArchive = () => {
  const grouped = sortedPosts().reduce((map, post) => { const year = post.date.slice(0,4); (map[year] ||= []).push(post); return map }, {})
  return `${renderPageBanner('ARCHIVE', t('archive.title'))}<section class="page-section"><div class="content-panel archive-list">${Object.entries(grouped).map(([year, posts]) => `<section><h2 class="archive-year">${year}</h2>${posts.map(post => `<div class="archive-item"><time>${formatDate(post.date)}</time><div><a href="#post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a><small>${escapeHtml(post.category)}</small></div></div>`).join('')}</section>`).join('')}</div></section>`
}

const renderCategories = () => {
  const categories = countBy('category')
  return `${renderPageBanner('CATEGORIES', t('categories.title'))}<section class="page-section"><div class="tax-grid">${Object.entries(categories).map(([name, count]) => `<div class="tax-card"><a href="#category/${encodeURIComponent(name)}">${escapeHtml(name)}<span>${count}</span></a></div>`).join('')}</div></section>`
}

const renderTags = () => {
  const tags = countBy('tags')
  return `${renderPageBanner('TAGS', t('tags.title'))}<section class="page-section"><div class="content-panel cloud-panel"><div class="cloud">${Object.entries(tags).sort((a,b) => b[1] - a[1]).map(([name, count]) => `<a href="#tag/${encodeURIComponent(name)}">${escapeHtml(name)} · ${count}</a>`).join('')}</div></div></section>`
}

const renderAbout = () => `${renderPageBanner('ABOUT', t('about.title'))}<section class="page-section"><div class="content-panel about-panel"><div><span class="eyebrow">${t('about.label')}</span><h2>${escapeHtml(state.site.displayName)}</h2><p>${escapeHtml(state.site.bio)}</p></div><div class="about-facts"><div class="fact"><span>专业 / Major</span><strong>${escapeHtml(state.site.profession)}</strong></div><div class="fact"><span>研究方向 / Research</span><strong>${escapeHtml(state.site.research)}</strong></div><div class="fact"><span>Website</span><strong>${escapeHtml(state.site.name)}</strong></div></div></div></section>`

const renderFriends = () => `${renderPageBanner('FRIENDS', t('friends.title'))}<section class="page-section"><div class="friends-grid">${state.site.links.map(link => `<article class="friend-card"><span class="eyebrow">LINK</span><h3>${escapeHtml(link.label)}</h3><p>${escapeHtml(link.url)}</p><a class="section-link" href="${safeUrl(link.url)}" target="_blank" rel="noreferrer">Open link →</a></article>`).join('')}</div></section>`

const getHeadings = post => [...post.content.matchAll(/^#{2,4}\s+(.+)$/gm)].map(match => match[1].replace(/[*_`]/g, ''))

const renderArticle = post => {
  const headings = getHeadings(post)
  const viewKey = `qxy-view-${post.slug}`
  localStorage.setItem(viewKey, String(Number(localStorage.getItem(viewKey) || 0) + 1))
  const title = localized(post, 'title') || post.title
  const category = localized(post, 'category') || post.category
  document.title = `${title} · ${state.site.name}`
  return `<section class="page-banner" style="--hero-image: url('${assetUrl(state.site.hero)}')"><div class="page-banner-inner"><a class="section-link" href="#home">← ${t('article.back')}</a><h1>${escapeHtml(title)}</h1><div class="post-meta"><time>${formatDate(post.date)}</time><span>·</span><span>${escapeHtml(category)}</span><span>·</span><span>${wordCount(post)} words</span></div></div></section><section class="page-section"><div class="article-layout"><article class="article-card"><div class="article-cover"><img src="${safeUrl(assetUrl(post.cover || state.site.defaultCover))}" alt="${escapeHtml(title)}" data-lightbox /></div><div class="article-content"><header class="article-header"><span class="eyebrow">${escapeHtml(category)}</span><h1>${escapeHtml(title)}</h1><p>${formatDate(post.date)} · ${post.tags.map(escapeHtml).join(' / ')}</p></header><div class="article-body">${renderMarkdown(post.content)}</div><div class="article-footer"><span>QXY Web · ${escapeHtml(state.site.displayName)}</span><span>${localStorage.getItem(viewKey)} views</span></div><section class="comments-box"><h3>${t('article.comments')}</h3><p>${t('article.commentsHint')}</p></section></div></article><aside class="article-aside"><div class="toc-card"><h3>${t('article.toc')}</h3>${headings.length ? headings.map((heading, index) => { const id = heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || `section-${index}`; return `<a href="#${id}">${index + 1}. ${escapeHtml(heading)}</a>` }).join('') : `<span class="muted">${t('empty')}</span>`}</div>${renderProfile()}</aside></div></section>`
}

const renderFiltered = (type, value) => {
  const posts = state.posts.filter(post => type === 'category' ? post.category === value : post.tags.includes(value))
  const label = type === 'category' ? 'CATEGORY' : 'TAG'
  return `${renderPageBanner(label, value)}<section class="page-section"><div class="home-layout"><div class="post-grid">${posts.length ? posts.map(renderPostCard).join('') : `<div class="content-panel cloud-panel">${t('empty')}</div>`}</div>${renderSidebar()}</div></section>`
}

const route = () => {
  const queryPost = new URLSearchParams(location.search).get('post')
  if (queryPost) {
    const post = state.posts.find(item => item.slug === queryPost)
    if (post) return renderArticle(post)
  }
  const hash = decodeURIComponent(location.hash.replace(/^#/, '') || 'home')
  if (hash === 'home') { document.title = `${state.site.name} · ${state.site.displayName}`; return renderHome() }
  if (hash === 'archive') return renderArchive()
  if (hash === 'categories') return renderCategories()
  if (hash === 'tags') return renderTags()
  if (hash === 'about') return renderAbout()
  if (hash === 'friends') return renderFriends()
  if (hash.startsWith('post/')) { const post = state.posts.find(item => item.slug === hash.slice(5)); return post ? renderArticle(post) : renderHome() }
  if (hash.startsWith('category/')) return renderFiltered('category', hash.slice(9))
  if (hash.startsWith('tag/')) return renderFiltered('tag', hash.slice(4))
  return renderHome()
}

const render = () => {
  app.innerHTML = route()
  renderHeaderText()
  updateFooterRuntime()
  app.focus({ preventScroll: true })
  bindArticleActions()
}

const bindArticleActions = () => {
  document.querySelectorAll('[data-copy-code]').forEach(button => button.addEventListener('click', async () => {
    const code = button.parentElement.querySelector('pre').textContent
    await navigator.clipboard?.writeText(code)
    button.textContent = t('article.copied')
    showToast(t('article.copied'))
    setTimeout(() => { button.textContent = t('article.copy') }, 1400)
  }))
  document.querySelectorAll('[data-lightbox]').forEach(image => image.addEventListener('click', () => {
    const layer = document.createElement('div')
    layer.className = 'search-layer is-open'
    layer.innerHTML = `<div class="search-box" style="padding:12px;background:transparent;border:0;box-shadow:none"><img src="${image.src}" alt="${image.alt}" style="width:100%;max-height:82vh;object-fit:contain;cursor:zoom-out" /></div>`
    layer.addEventListener('click', () => layer.remove())
    document.body.append(layer)
  }))
}

const openSearch = () => {
  const layer = document.querySelector('#searchLayer')
  layer.classList.add('is-open'); layer.setAttribute('aria-hidden', 'false')
  const input = document.querySelector('#searchInput'); input.value = ''; input.focus(); renderSearch('')
}
const closeSearch = () => { const layer = document.querySelector('#searchLayer'); layer.classList.remove('is-open'); layer.setAttribute('aria-hidden', 'true') }
const renderSearch = query => {
  const normalized = query.trim().toLowerCase()
  const results = sortedPosts().filter(post => !normalized || [post.title, post.excerpt, post.content, post.category, ...post.tags].join(' ').toLowerCase().includes(normalized))
  document.querySelector('#searchResults').innerHTML = results.length ? results.map(post => `<a class="search-result" href="#post/${encodeURIComponent(post.slug)}"><strong>${escapeHtml(post.title)}</strong><small>${formatDate(post.date)} · ${escapeHtml(post.category)}</small></a>`).join('') : `<div class="muted">${t('empty')}</div>`
}

const openDrawer = () => { const drawer = document.querySelector('#mobileDrawer'); drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false') }
const closeDrawer = () => { const drawer = document.querySelector('#mobileDrawer'); drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true') }

const padTime = value => String(value).padStart(2, '0')
const updateFooterRuntime = () => {
  const target = document.querySelector('#footerRuntime')
  if (!target || !state.site?.createdAt) return
  let seconds = Math.max(0, Math.floor((Date.now() - new Date(state.site.createdAt).getTime()) / 1000))
  const years = Math.floor(seconds / (365 * 24 * 3600)); seconds %= 365 * 24 * 3600
  const days = Math.floor(seconds / (24 * 3600)); seconds %= 24 * 3600
  const hours = Math.floor(seconds / 3600); seconds %= 3600
  const minutes = Math.floor(seconds / 60); const remainder = seconds % 60
  const beijing = new Intl.DateTimeFormat(state.lang === 'zh' ? 'zh-CN' : 'en-US', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date())
  target.textContent = state.lang === 'zh'
    ? `网站运行 ${years} 年 ${days} 天 ${padTime(hours)}:${padTime(minutes)}:${padTime(remainder)} · 北京时间 ${beijing}`
    : `Online ${years}y ${days}d ${padTime(hours)}:${padTime(minutes)}:${padTime(remainder)} · Beijing ${beijing}`
}

const init = async () => {
  const [siteResponse, postsResponse] = await Promise.all([fetch('content/site.json'), fetch('content/posts.json')])
  state.site = await siteResponse.json(); state.posts = await postsResponse.json()
  setTheme(state.theme)
  const visitCount = Number(localStorage.getItem('qxy-visits') || 0) + 1
  localStorage.setItem('qxy-visits', String(visitCount))
  render()
  updateFooterRuntime()
  setInterval(updateFooterRuntime, 1000)
  window.addEventListener('hashchange', render)
  document.querySelector('#themeButton').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'))
  document.querySelector('#languageButton').addEventListener('click', () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('qxy-lang', state.lang); render() })
  document.querySelector('#searchButton').addEventListener('click', openSearch)
  document.querySelector('#searchClose').addEventListener('click', closeSearch)
  document.querySelector('#searchLayer').addEventListener('click', event => { if (event.target.id === 'searchLayer') closeSearch() })
  document.querySelector('#searchInput').addEventListener('input', event => renderSearch(event.target.value))
  document.querySelector('#menuButton').addEventListener('click', openDrawer)
  document.querySelector('#drawerClose').addEventListener('click', closeDrawer)
  document.querySelector('#drawerBackdrop').addEventListener('click', closeDrawer)
  document.querySelectorAll('.drawer-nav a').forEach(link => link.addEventListener('click', closeDrawer))
  document.querySelector('#backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
  window.addEventListener('scroll', () => { document.querySelector('#topbar').classList.toggle('is-scrolled', window.scrollY > 30); document.querySelector('#backTop').classList.toggle('is-visible', window.scrollY > 420) }, { passive: true })
}

init().catch(error => { app.innerHTML = `<section class="page-section"><div class="content-panel cloud-panel"><h1>QXY Web</h1><p>内容加载失败：${escapeHtml(error.message)}</p></div></section>` })
