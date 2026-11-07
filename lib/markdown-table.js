const splitRow = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
const isSeparator = line => /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line || '')
const isImage = cell => /^!\[[^\]]*\]\([^)]+\)$/.test(cell)

export const renderMarkdownTable = (lines, start, inline) => {
  if (!String(lines[start] || '').trim().startsWith('|') || !isSeparator(String(lines[start + 1] || '').trim())) return null

  const rows = []
  let end = start + 1
  for (let index = start; index < lines.length && String(lines[index]).trim().startsWith('|'); index += 1) {
    const line = String(lines[index]).trim()
    if (!isSeparator(line)) rows.push(splitRow(line))
    end = index
  }
  if (!rows.length || rows.some(row => row.length !== rows[0].length)) return null

  const imageGrid = rows.flat().every(isImage)
  if (imageGrid) {
    return {
      end,
      html: `<div class="article-image-grid">${rows.flat().map(cell => `<div>${inline(cell, true)}</div>`).join('')}</div>`
    }
  }

  const [header, ...body] = rows
  return {
    end,
    html: `<div class="article-table-wrap"><table><thead><tr>${header.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  }
}
