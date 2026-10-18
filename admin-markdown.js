export const parseMarkdownPost = (raw, fallbackDate) => {
  const source = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = source.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/)
  if (!match) {
    const lines = source.trimStart().split('\n')
    const firstContentLine = lines.findIndex(line => line.trim())
    const heading = firstContentLine >= 0 ? lines[firstContentLine].trim().match(/^#\s+(.+?)\s*#*$/) : null
    const title = heading?.[1]?.trim() || ''
    if (heading) lines.splice(firstContentLine, 1)
    return {
      slug: '', title, titleEn: '', date: fallbackDate, updated: '', category: '', categoryEn: '',
      tags: [], tagsEn: [], cover: '', excerpt: '', excerptEn: '', content: lines.join('\n').trim()
    }
  }

  const meta = {}
  match[1].split('\n').forEach(line => {
    const index = line.indexOf(':')
    if (index >= 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  })
  const parseTags = value => (value || '').replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean)
  return {
    slug: meta.slug || '',
    title: meta.title || '',
    titleEn: meta.titleEn || '',
    date: meta.date || fallbackDate,
    updated: meta.updated || '',
    category: meta.category || '',
    categoryEn: meta.categoryEn || '',
    tags: parseTags(meta.tags),
    tagsEn: parseTags(meta.tagsEn),
    cover: meta.cover || '',
    excerpt: meta.excerpt || '',
    excerptEn: meta.excerptEn || '',
    content: match[2].trim()
  }
}
