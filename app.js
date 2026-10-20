const state = {
  site: null,
  posts: [],
  lang: localStorage.getItem('qxy-lang') || 'zh',
  theme: localStorage.getItem('qxy-theme') || 'light',
  typingTimer: null,
  pendingAnchor: ''
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
    'home.profile': '关于我', 'home.categories': '分类', 'home.tags': '常用标签', 'home.archivePanel': '归档', 'home.stats': '网站信息',
    'home.posts': '文章', 'home.words': '总字数', 'home.views': '访问量', 'home.rss': 'RSS', 'home.sitemap': '站点地图', 'home.admin': '管理台', 'home.subscribe': '订阅', 'home.view': '查看', 'home.manage': '管理', 'article.back': '返回首页', 'post.published': '发表于', 'post.updated': '更新于：',
    'article.comments': '评论', 'article.commentsHint': '评论区已预留，配置 Giscus 后即可启用。',
    'article.author': '文章作者', 'article.link': '文章链接', 'article.copyright': '版权声明',
    'article.copyrightText': '本文由 QXY 发布于 QXY Web，转载请注明作者、原文链接及来源。', 'article.disclaimerLabel': '免责声明',
    'article.disclaimer': '本文仅为作者个人经验分享，供学习交流，不构成专业建议或操作保证。内容可能存在疏漏，软件版本、设备与环境差异也可能导致结果不同；请结合官方文档核验，操作前做好备份并先在可控环境验证。未核实适用条件而直接照搬所产生的风险，请自行评估并承担。',
    'article.share': '分享文章', 'article.next': '下一篇', 'article.previous': '上一篇',
    'article.navigation': '文章导航', 'article.copyFailed': '复制失败，请检查浏览器权限后重试。',
    'article.latest': '最新文章', 'article.wechatTitle': '用微信分享',
    'article.wechatHint': '使用微信扫描二维码打开本文。', 'article.copyLink': '复制文章链接',
    'article.linkCopied': '文章链接已复制', 'article.qrUnavailable': '二维码暂时无法加载，可复制文章链接后在微信中发送。',
    'common.close': '关闭', 'share.facebook': '分享到 Facebook', 'share.twitter': '分享到 Twitter',
    'share.wechat': '分享到微信', 'share.weibo': '分享到微博', 'share.qq': '分享到 QQ',
    'article.toc': '目录', 'article.copy': '复制', 'article.copied': '已复制', 'about.title': '关于 QXY Web',
    'about.label': 'ABOUT', 'friends.title': '友链', 'archive.title': '时间轴', 'categories.title': '分类',
    'tags.title': '标签', 'empty': '这里还没有内容。'
  },
  en: {
    'nav.home': 'Home', 'nav.archive': 'Archive', 'nav.categories': 'Categories', 'nav.tags': 'Tags', 'nav.about': 'About',
    'search.title': 'Search posts', 'search.placeholder': 'Search title, tag or keyword', 'home.latest': 'Latest notes',
    'home.latestDesc': 'Keeping the things I am learning, one note at a time.', 'home.all': 'View all', 'home.archive': 'Timeline',
    'home.profile': 'About me', 'home.categories': 'Categories', 'home.tags': 'Common tags', 'home.archivePanel': 'Archive', 'home.stats': 'Site info',
    'home.posts': 'Posts', 'home.words': 'Words', 'home.views': 'Visits', 'home.rss': 'RSS', 'home.sitemap': 'Sitemap', 'home.admin': 'Admin', 'home.subscribe': 'Subscribe', 'home.view': 'View', 'home.manage': 'Manage', 'article.back': 'Back home', 'post.published': 'Published: ', 'post.updated': 'Updated: ',
    'article.comments': 'Comments', 'article.commentsHint': 'The comment area is ready for Giscus configuration.',
    'article.author': 'Author', 'article.link': 'Article link', 'article.copyright': 'Copyright',
    'article.copyrightText': 'Published by QXY on QXY Web. Please credit the author, original link, and source when reproducing this article.', 'article.disclaimerLabel': 'Disclaimer',
    'article.disclaimer': 'This article reflects the author’s personal experience and is for learning and discussion only. It is not professional advice or a guarantee of results. It may contain omissions, and software versions, devices, and environments can differ. Verify details against official documentation, back up your data, and test in a controlled environment before acting. Assess and accept the risks of applying these instructions without checking their suitability.',
    'article.share': 'Share this article', 'article.next': 'Next article', 'article.previous': 'Previous article',
    'article.navigation': 'Article navigation', 'article.copyFailed': 'Copy failed. Check browser permissions and try again.',
    'article.latest': 'Latest articles', 'article.wechatTitle': 'Share with WeChat',
    'article.wechatHint': 'Scan this QR code with WeChat to open the article.', 'article.copyLink': 'Copy article link',
    'article.linkCopied': 'Article link copied', 'article.qrUnavailable': 'The QR code could not be loaded. Copy the article link and send it in WeChat.',
    'common.close': 'Close', 'share.facebook': 'Share on Facebook', 'share.twitter': 'Share on Twitter',
    'share.wechat': 'Share on WeChat', 'share.weibo': 'Share on Weibo', 'share.qq': 'Share on QQ',
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

const headingSlug = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')

const parseMarkdownHeadings = markdown => {
  const source = String(markdown || '').replace(/```[\w-]*\r?\n[\s\S]*?```/g, '')
  const counts = new Map()
  return [...source.matchAll(/^(#{2,4})\s+(.+)$/gm)].map(match => {
    const text = match[2].replace(/[*_`]/g, '').trim()
    const baseId = headingSlug(text) || 'section'
    const count = counts.get(baseId) || 0
    counts.set(baseId, count + 1)
    return { level: match[1].length, text, id: count ? `${baseId}-${count + 1}` : baseId }
  })
}

const renderMarkdown = markdown => {
  const codeBlocks = []
  const source = String(markdown || '').replace(/```(\w*)\n([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.push({ language: language || 'text', code: code.trimEnd() }) - 1
    return `\n@@CODE_${index}@@\n`
  })
  const lines = source.split(/\r?\n/)
  const output = []
  const headings = parseMarkdownHeadings(source)
  let headingIndex = 0
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
      const { level, text, id } = headings[headingIndex++]
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
const renderPublishedDate = post => `<div class="post-date-meta post-published-date"><span><strong>${t('post.published')}</strong><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></span></div>`
const renderPostDates = post => `<div class="post-date-meta"><span><strong>${t('post.published')}</strong><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></span><span><strong>${t('post.updated')}</strong><time datetime="${escapeHtml(post.updated || post.date)}">${formatDate(post.updated || post.date)}</time></span></div>`
const wordCount = post => post.content.replace(/[`#>*_\-\[\]()]/g, '').replace(/\s/g, '').length
const sortedPosts = () => [...state.posts].sort((a, b) => b.date.localeCompare(a.date))
const recentlyUpdatedPosts = () => [...state.posts].sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date))
const articleUrl = post => {
  const url = new URL(location.pathname || '/', location.origin)
  url.search = ''
  url.hash = `post/${encodeURIComponent(post.slug)}`
  return url.href
}

const renderLatestArticles = () => `<section class="side-card latest-articles-card"><h3>${t('article.latest')}</h3><div class="latest-articles-list">${sortedPosts().slice(0, 5).map(post => `<a class="latest-article" href="#post/${encodeURIComponent(post.slug)}"><img src="${safeUrl(assetUrl(post.cover || state.site.defaultCover))}" alt="" loading="lazy" /><span class="latest-article-copy"><strong>${escapeHtml(localized(post, 'title') || post.title)}</strong><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></span></a>`).join('')}</div></section>`

const getAdjacentPost = post => {
  const posts = sortedPosts()
  const index = posts.findIndex(item => item.slug === post.slug)
  if (index < 0 || posts.length < 2) return null
  if (posts[index + 1]) return { post: posts[index + 1], direction: 'next' }
  return { post: posts[index - 1], direction: 'previous' }
}

const renderArticleNavigation = post => {
  const adjacent = getAdjacentPost(post)
  if (!adjacent) return ''
  const { post: nextPost, direction } = adjacent
  return `<nav class="article-next-nav" aria-label="${t('article.navigation')}"><a class="article-next-link" href="#post/${encodeURIComponent(nextPost.slug)}"><img src="${safeUrl(assetUrl(nextPost.cover || state.site.defaultCover))}" alt="" loading="lazy" /><span class="article-next-overlay"><span>${t(`article.${direction}`)}</span><strong>${escapeHtml(localized(nextPost, 'title') || nextPost.title)}</strong><time datetime="${escapeHtml(nextPost.date)}">${formatDate(nextPost.date)}</time></span></a></nav>`
}

const renderShareActions = post => {
  const url = articleUrl(post)
  const title = localized(post, 'title') || post.title
  const shareLink = (base, values) => {
    const target = new URL(base)
    Object.entries(values).forEach(([key, value]) => target.searchParams.set(key, value))
    return target.href
  }
  const facebook = shareLink('https://www.facebook.com/sharer/sharer.php', { u: url })
  const twitter = shareLink('https://twitter.com/intent/tweet', { url, text: title })
  const weibo = shareLink('https://service.weibo.com/share/share.php', { url, title })
  const qq = shareLink('https://connect.qq.com/widget/shareqq/index.html', { url, title, summary: post.excerpt || '', pics: new URL(assetUrl(post.cover || state.site.defaultCover), location.href).href })
  const qr = shareLink('https://api.qrserver.com/v1/create-qr-code/', { size: '220x220', data: url })
  return `<nav class="article-share-row" aria-label="${t('article.share')}">
    <a class="share-button share-facebook" href="${escapeHtml(facebook)}" target="_blank" rel="noopener noreferrer" aria-label="${t('share.facebook')}" title="${t('share.facebook')}"><span aria-hidden="true">f</span></a>
    <a class="share-button share-twitter" href="${escapeHtml(twitter)}" target="_blank" rel="noopener noreferrer" aria-label="${t('share.twitter')}" title="${t('share.twitter')}"><span aria-hidden="true">X</span></a>
    <button class="share-button share-wechat" type="button" data-open-wechat aria-label="${t('share.wechat')}" title="${t('share.wechat')}"><span aria-hidden="true">微</span></button>
    <a class="share-button share-weibo" href="${escapeHtml(weibo)}" target="_blank" rel="noopener noreferrer" aria-label="${t('share.weibo')}" title="${t('share.weibo')}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z"/></svg></a>
    <a class="share-button share-qq" href="${escapeHtml(qq)}" target="_blank" rel="noopener noreferrer" aria-label="${t('share.qq')}" title="${t('share.qq')}"><span aria-hidden="true">Q</span></a>
  </nav>
  <dialog class="wechat-share-dialog" data-wechat-dialog aria-labelledby="wechatShareTitle">
    <div class="wechat-share-head"><div><span class="eyebrow">QXY WEB</span><h2 id="wechatShareTitle">${t('article.wechatTitle')}</h2></div><button class="icon-button" type="button" data-close-wechat aria-label="${t('common.close')}" title="${t('common.close')}">×</button></div>
    <p>${t('article.wechatHint')}</p>
    <div class="wechat-qr-frame"><img src="${escapeHtml(qr)}" alt="${t('article.wechatHint')}" data-share-qr referrerpolicy="no-referrer" /><p data-qr-fallback hidden>${t('article.qrUnavailable')}</p></div>
    <button class="copy-link-button" type="button" data-copy-article-link>${t('article.copyLink')}</button>
  </dialog>`
}

const renderArticleCopyright = post => `<section class="article-copyright" aria-label="${t('article.copyright')}">
  <p><strong>${t('article.author')}：</strong>QXY</p>
  <p><strong>${t('article.link')}：</strong><a href="${escapeHtml(articleUrl(post))}">${escapeHtml(articleUrl(post))}</a></p>
  <p><strong>${t('article.copyright')}：</strong>${t('article.copyrightText')}</p>
  <p class="article-disclaimer"><strong>${t('article.disclaimerLabel')}：</strong>${t('article.disclaimer')}</p>
</section>`

const commentsReady = () => {
  const comments = state.site?.comments
  return comments?.enabled && comments.provider === 'giscus' && comments.repo && comments.repoId && comments.category && comments.categoryId
}

const renderComments = () => commentsReady()
  ? `<section class="comments-box comments-box-live"><h3>${t('article.comments')}</h3><div class="giscus" data-giscus-container></div></section>`
  : `<section class="comments-box"><h3>${t('article.comments')}</h3><p>${t('article.commentsHint')}</p></section>`

const initializeGiscus = () => {
  const container = document.querySelector('[data-giscus-container]')
  const comments = state.site?.comments
  if (!container || !commentsReady()) return
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  script.dataset.repo = comments.repo
  script.dataset.repoId = comments.repoId
  script.dataset.category = comments.category
  script.dataset.categoryId = comments.categoryId
  script.dataset.mapping = comments.mapping || 'title'
  script.dataset.strict = comments.strict || '0'
  script.dataset.reactionsEnabled = comments.reactionsEnabled || '1'
  script.dataset.emitMetadata = comments.emitMetadata || '0'
  script.dataset.inputPosition = comments.inputPosition || 'bottom'
  script.dataset.theme = comments.theme || 'preferred_color_scheme'
  script.dataset.lang = comments.lang || (state.lang === 'zh' ? 'zh-CN' : 'en')
  container.append(script)
}
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
      <p class="hero-subtitle"><span id="heroTyped"></span><span class="type-cursor" aria-hidden="true"></span></p>
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
  const archives = sortedPosts().reduce((map, post) => {
    const key = post.date.slice(0, 7)
    map[key] = (map[key] || 0) + 1
    return map
  }, {})
  const archiveLabel = key => {
    const [year, month] = key.split('-')
    return state.lang === 'en'
      ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(new Date(`${key}-01T00:00:00`))
      : `${year}年${Number(month)}月`
  }
  return `<aside class="sidebar">${renderProfile()}
    <div class="side-card"><h3>${t('home.categories')}</h3><ul class="side-list">${Object.entries(categories).map(([name, count]) => `<li><a href="#category/${encodeURIComponent(name)}">${escapeHtml(name)}<small>${count}</small></a></li>`).join('')}</ul></div>
    <div class="side-card"><h3>${t('home.tags')}</h3><div class="side-tag-cloud">${Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0, 12).map(([name, count]) => `<a class="tag-chip" href="#tag/${encodeURIComponent(name)}">${escapeHtml(name)} ${count}</a>`).join('')}</div></div>
    <div class="side-card"><h3>${t('home.archivePanel')}</h3><ul class="side-list archive-side-list">${Object.entries(archives).map(([key, count]) => `<li><a href="#archive">${escapeHtml(archiveLabel(key))}<small>${count}</small></a></li>`).join('')}</ul></div>
  </aside>`
}

const renderPostCard = post => `<article class="post-card">
  <a class="post-cover" href="#post/${encodeURIComponent(post.slug)}"><img src="${safeUrl(assetUrl(post.cover || state.site.defaultCover))}" alt="${escapeHtml(localized(post, 'title') || post.title)}" loading="lazy" /></a>
  <div class="post-info"><h3><a href="#post/${encodeURIComponent(post.slug)}">${escapeHtml(localized(post, 'title') || post.title)}</a></h3><p>${escapeHtml(localized(post, 'excerpt') || post.excerpt)}</p>${renderPublishedDate(post)}<div class="post-tags">${post.tags.map(tag => `<a class="tag-chip" href="#tag/${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`).join('')}</div></div>
</article>`

const renderHome = () => `${renderHero()}<section class="page-section" id="latest"><div class="section-heading"><div><span class="eyebrow">QXY NOTES</span><h2>${t('home.latest')}</h2></div><div><p>${t('home.latestDesc')}</p><a class="section-link" href="#archive">${t('home.all')} →</a></div></div><div class="home-layout"><div class="post-grid">${recentlyUpdatedPosts().map(renderPostCard).join('')}</div>${renderSidebar()}</div></section>`

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

const getHeadings = post => parseMarkdownHeadings(post.content)

const renderArticle = post => {
  const headings = getHeadings(post)
  const viewKey = `qxy-view-${post.slug}`
  localStorage.setItem(viewKey, String(Number(localStorage.getItem(viewKey) || 0) + 1))
  const title = localized(post, 'title') || post.title
  const category = localized(post, 'category') || post.category
  document.title = `${title} · ${state.site.name}`
  return `<section class="page-banner" style="--hero-image: url('${assetUrl(state.site.hero)}')"><div class="page-banner-inner"><a class="section-link" href="#home">← ${t('article.back')}</a><h1>${escapeHtml(title)}</h1>${renderPostDates(post)}<div class="post-meta"><span>${escapeHtml(category)}</span><span>·</span><span>${wordCount(post)} words</span></div></div></section>
    <section class="page-section"><div class="article-layout">
      <article class="article-card"><div class="article-cover"><img src="${safeUrl(assetUrl(post.cover || state.site.defaultCover))}" alt="${escapeHtml(title)}" data-lightbox /></div>
        <div class="article-content"><header class="article-header"><span class="eyebrow">${escapeHtml(category)}</span><h1>${escapeHtml(title)}</h1><p>${post.tags.map(escapeHtml).join(' / ')}</p></header>
          <div class="article-body">${renderMarkdown(post.content)}</div>
          <div class="article-footer"><span>QXY Web · ${escapeHtml(state.site.displayName)}</span><span>${localStorage.getItem(viewKey)} views</span></div>
          ${renderComments()}
          ${renderArticleCopyright(post)}
          ${renderShareActions(post)}
          ${renderArticleNavigation(post)}
        </div>
      </article>
      <aside class="article-aside">${headings.length ? `<nav class="toc-card" aria-label="${t('article.toc')}"><h3>${t('article.toc')}</h3>${headings.map(heading => `<a class="toc-level-${heading.level}" href="#post/${encodeURIComponent(post.slug)}/${encodeURIComponent(heading.id)}">${escapeHtml(heading.text)}</a>`).join('')}</nav>` : ''}${renderProfile()}${renderLatestArticles()}</aside>
    </div></section>`
}

const renderFiltered = (type, value) => {
  const posts = state.posts.filter(post => type === 'category' ? post.category === value : post.tags.includes(value))
  const label = type === 'category' ? 'CATEGORY' : 'TAG'
  return `${renderPageBanner(label, value)}<section class="page-section"><div class="home-layout"><div class="post-grid">${posts.length ? posts.map(renderPostCard).join('') : `<div class="content-panel cloud-panel">${t('empty')}</div>`}</div>${renderSidebar()}</div></section>`
}

const startHeroTyping = () => {
  clearInterval(state.typingTimer)
  const target = document.querySelector('#heroTyped')
  if (!target) return
  const phrase = state.lang === 'zh' ? state.site.subtitle : state.site.englishSubtitle
  let index = 0
  target.textContent = ''
  state.typingTimer = setInterval(() => {
    target.textContent = phrase.slice(0, index)
    index += 1
    if (index > phrase.length) clearInterval(state.typingTimer)
  }, 82)
}

const route = () => {
  state.pendingAnchor = ''
  const hash = decodeURIComponent(location.hash.replace(/^#/, '') || 'home')
  if (hash === 'home') {
    const queryPost = new URLSearchParams(location.search).get('post')
    const post = state.posts.find(item => item.slug === queryPost)
    if (post) return renderArticle(post)
    document.title = `${state.site.name} · ${state.site.displayName}`
    return renderHome()
  }
  if (hash === 'archive') return renderArchive()
  if (hash === 'categories') return renderCategories()
  if (hash === 'tags') return renderTags()
  if (hash === 'about') return renderAbout()
  if (hash === 'friends') return renderFriends()
  if (hash.startsWith('post/')) {
    const [slug, ...anchorParts] = hash.slice(5).split('/')
    const post = state.posts.find(item => item.slug === slug)
    if (post) {
      state.pendingAnchor = anchorParts.join('/')
      return renderArticle(post)
    }
    return renderHome()
  }
  if (hash.startsWith('category/')) return renderFiltered('category', hash.slice(9))
  if (hash.startsWith('tag/')) return renderFiltered('tag', hash.slice(4))
  return renderHome()
}

const render = () => {
  app.innerHTML = route()
  renderHeaderText()
  updateFooterRuntime()
  startHeroTyping()
  app.focus({ preventScroll: true })
  if (state.pendingAnchor) {
    const anchor = state.pendingAnchor
    state.pendingAnchor = ''
    window.setTimeout(() => {
      const target = document.getElementById(anchor)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }
  initializeGiscus()
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

  const dialog = document.querySelector('[data-wechat-dialog]')
  if (!dialog) return
  document.querySelector('[data-open-wechat]')?.addEventListener('click', () => dialog.showModal())
  document.querySelector('[data-close-wechat]')?.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  document.querySelector('[data-share-qr]')?.addEventListener('error', event => {
    event.currentTarget.hidden = true
    document.querySelector('[data-qr-fallback]').hidden = false
  })
  document.querySelector('[data-copy-article-link]')?.addEventListener('click', async () => {
    const link = document.querySelector('.article-copyright a')?.href
    if (!link) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link)
      else {
        const input = document.createElement('textarea')
        input.value = link
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.append(input)
        input.select()
        const copied = document.execCommand('copy')
        input.remove()
        if (!copied) throw new Error('Clipboard unavailable')
      }
      showToast(t('article.linkCopied'))
    } catch {
      showToast(t('article.copyFailed'))
    }
  })
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

const updateFooterRuntime = () => {
  const target = document.querySelector('#footerRuntime')
  if (!target || !state.site?.createdAt) return
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(state.site.createdAt).getTime()) / 86400000))
  const years = Math.floor(elapsedDays / 365)
  const days = elapsedDays % 365
  const beijing = new Intl.DateTimeFormat(state.lang === 'zh' ? 'zh-CN' : 'en-US', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date())
  target.textContent = state.lang === 'zh'
    ? `网站运行 ${years} 年 ${days} 天 · 北京时间 ${beijing}`
    : `Online ${years}y ${days}d · Beijing ${beijing}`
}

const init = async () => {
  const [siteResponse, postsResponse] = await Promise.all([fetch('content/site.json?v=homepage-layout-fixes-1'), fetch('content/posts.json?v=first-post-translation-1')])
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
