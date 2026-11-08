const splitYamlList = value => {
  const items = []
  let token = ''
  let quote = ''
  let escaped = false
  for (const character of value) {
    if (escaped) {
      token += character
      escaped = false
    } else if (character === '\\' && quote === '"') {
      token += character
      escaped = true
    } else if (quote) {
      token += character
      if (character === quote) quote = ''
    } else if (character === '"' || character === "'") {
      token += character
      quote = character
    } else if (character === ',') {
      items.push(token.trim())
      token = ''
    } else {
      token += character
    }
  }
  if (token.trim()) items.push(token.trim())
  return items.map(item => {
    if (item.startsWith('"') && item.endsWith('"')) {
      try { return JSON.parse(item) } catch {}
    }
    if (item.startsWith("'") && item.endsWith("'")) return item.slice(1, -1).replaceAll("''", "'")
    return item
  }).filter(Boolean)
}

export const parseFrontmatterValue = value => {
  const clean = String(value ?? '').trim()
  if (clean.startsWith('[') && clean.endsWith(']')) {
    try {
      const parsed = JSON.parse(clean)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    return splitYamlList(clean.slice(1, -1))
  }
  if (clean.startsWith('"') && clean.endsWith('"')) {
    try { return JSON.parse(clean) } catch {}
  }
  if (clean.startsWith("'") && clean.endsWith("'")) return clean.slice(1, -1).replaceAll("''", "'")
  return clean
}
