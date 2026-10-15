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
    date: post.date,
    category: post.category || '随笔',
    tags: Array.isArray(post.tags) ? post.tags : [post.tags].filter(Boolean),
    cover: post.cover || site.defaultCover,
    excerpt: post.excerpt || '',
    content: post.content
  })
}

await fs.writeFile(postsOut, `${JSON.stringify(posts, null, 2)}\n`, 'utf8')

const origin = site.baseUrl || 'https://YOUR-USERNAME.github.io/YOUR-REPO'
const urls = ['', ...posts.map(post => `?post=${encodeURIComponent(post.slug)}`)]
const lastmod = new Date().toISOString().slice(0, 10)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(`${origin}/${url}`)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`
const rssItems = posts.map(post => `  <item>\n    <title>${escapeXml(post.title)}</title>\n    <link>${escapeXml(`${origin}/?post=${encodeURIComponent(post.slug)}`)}</link>\n    <guid>${escapeXml(`${origin}/?post=${encodeURIComponent(post.slug)}`)}</guid>\n    <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>\n    <description>${escapeXml(post.excerpt)}</description>\n  </item>`).join('\n')
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeXml(site.name)}</title><link>${origin}</link><description>${escapeXml(site.subtitle)}</description>\n${rssItems}\n</channel></rss>\n`

await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8')
await fs.writeFile(path.join(root, 'rss.xml'), rss, 'utf8')
await fs.writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, 'utf8')
console.log(`Built ${posts.length} posts, RSS, sitemap and robots.txt`)
