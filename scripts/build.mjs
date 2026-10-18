import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const postsDir = path.join(root, 'content', 'posts')
const sitePath = path.join(root, 'content', 'site.json')
const postsOut = path.join(root, 'content', 'posts.json')

const escapeXml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const parseValue = value => {
  const clean = value.trim()
  if (clean.startsWith('[') && clean.endsWith(']')) {
    return clean.slice(1, -1).split(',').map(item => item.trim()).filter(Boolean)
  }
  return clean.replace(/^['"]|['"]$/g, '')
}

const parseMarkdown = raw => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) throw new Error('Missing front matter')
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index < 0) continue
    meta[line.slice(0, index).trim()] = parseValue(line.slice(index + 1))
  }
  return {
    ...meta,
    slug: meta.slug || '',
    content: match[2].trim()
  }
}

const shanghaiDate = value => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const site = JSON.parse(await fs.readFile(sitePath, 'utf8'))
const files = (await fs.readdir(postsDir)).filter(file => file.endsWith('.md')).sort().reverse()
const posts = []
for (const file of files) {
  const post = parseMarkdown(await fs.readFile(path.join(postsDir, file), 'utf8'))
  const slug = post.slug || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
  posts.push({
    id: slug,
    slug,
    title: post.title,
    titleEn: post.titleEn || '',
    date: post.date,
    updated: post.updated || post.date,
    sourcePath: `content/posts/${file}`,
    category: post.category || '随笔',
    categoryEn: post.categoryEn || '',
    tags: Array.isArray(post.tags) ? post.tags : [post.tags].filter(Boolean),
    tagsEn: Array.isArray(post.tagsEn) ? post.tagsEn : [post.tagsEn].filter(Boolean),
    cover: post.cover || site.defaultCover,
    excerpt: post.excerpt || '',
    excerptEn: post.excerptEn || '',
    content: post.content
  })
}

await fs.writeFile(postsOut, `${JSON.stringify(posts, null, 2)}\n`, 'utf8')

const origin = site.baseUrl || 'https://YOUR-USERNAME.github.io/YOUR-REPO'
const urls = ['', ...posts.map(post => `?post=${encodeURIComponent(post.slug)}`)]
const lastmod = shanghaiDate(new Date())
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url, index) => `  <url><loc>${escapeXml(`${origin}/${url}`)}</loc><lastmod>${index === 0 ? lastmod : escapeXml(posts[index - 1].updated || posts[index - 1].date)}</lastmod></url>`).join('\n')}\n</urlset>\n`
const rssItems = posts.map(post => `  <item>\n    <title>${escapeXml(post.title)}</title>\n    <link>${escapeXml(`${origin}/?post=${encodeURIComponent(post.slug)}`)}</link>\n    <guid>${escapeXml(`${origin}/?post=${encodeURIComponent(post.slug)}`)}</guid>\n    <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>\n    <description>${escapeXml(post.excerpt)}</description>\n  </item>`).join('\n')
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeXml(site.name)}</title><link>${origin}</link><description>${escapeXml(site.subtitle)}</description>\n${rssItems}\n</channel></rss>\n`

await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8')
await fs.writeFile(path.join(root, 'rss.xml'), rss, 'utf8')
await fs.writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, 'utf8')
console.log(`Built ${posts.length} posts, RSS, sitemap and robots.txt`)
