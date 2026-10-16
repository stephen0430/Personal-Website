import crypto from 'node:crypto'

export const SESSION_COOKIE = 'qxy_session'
export const STATE_COOKIE = 'qxy_oauth_state'

const allowedOrigin = () => process.env.ADMIN_ORIGIN || 'https://stephen0430.github.io'
const sessionSecret = () => process.env.SESSION_SECRET || ''
const key = () => crypto.createHash('sha256').update(sessionSecret()).digest()
const encode = value => Buffer.from(value).toString('base64url')

export const setCors = (req, res) => {
  const origin = req.headers.origin
  if (origin && origin === allowedOrigin()) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}

export const json = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export const createSession = payload => {
  if (!sessionSecret()) throw new Error('SESSION_SECRET is not configured')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }))
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  return [encode(iv), encode(cipher.getAuthTag()), encode(encrypted)].join('.')
}

export const readCookie = (req, name) => {
  const header = req.headers.cookie || ''
  const item = header.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return item ? item.slice(name.length + 1) : ''
}

export const readSession = req => {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token || !sessionSecret()) return null
  try {
    const [ivPart, tagPart, dataPart] = token.split('.')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    const data = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()])
    const payload = JSON.parse(data.toString('utf8'))
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

export const cookie = (name, value, maxAge = 86400) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`
export const clearCookie = name => cookie(name, '', 0)

export const getReturnUrl = value => {
  const fallback = process.env.ADMIN_RETURN_URL || `${allowedOrigin()}/Personal-Website/admin.html`
  if (!value) return fallback
  try {
    const parsed = new URL(value)
    return parsed.origin === allowedOrigin() && parsed.pathname.endsWith('/admin.html') ? parsed.toString() : fallback
  } catch {
    return fallback
  }
}

export const readJsonBody = req => new Promise((resolve, reject) => {
  let data = ''
  req.on('data', chunk => { data += chunk; if (data.length > 400000) reject(new Error('Request too large')) })
  req.on('end', () => {
    try { resolve(JSON.parse(data || '{}')) } catch (error) { reject(error) }
  })
  req.on('error', reject)
})
