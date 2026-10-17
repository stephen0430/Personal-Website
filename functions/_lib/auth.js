export const SESSION_COOKIE = 'qxy_session'
export const STATE_COOKIE = 'qxy_oauth_state'

const encoder = new TextEncoder()

const toBase64Url = bytes => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const fromBase64Url = value => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(normalized)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

const config = env => ({
  secret: env.SESSION_SECRET || '',
  allowedOrigin: env.ADMIN_ORIGIN || 'https://stephen0430.github.io',
  returnUrl: env.ADMIN_RETURN_URL || 'https://stephen0430.github.io/Personal-Website/admin.html',
  allowedLogin: env.ALLOWED_GITHUB_LOGIN || 'stephen0430'
})

const getKey = async secret => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export const createSession = async (env, payload) => {
  const { secret } = config(env)
  if (!secret) throw new Error('SESSION_SECRET is not configured')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = encoder.encode(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(secret), data)
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`
}

export const readCookie = (request, name) => {
  const header = request.headers.get('Cookie') || ''
  const item = header.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return item ? item.slice(name.length + 1) : ''
}

export const readSession = async (env, request) => {
  const token = readCookie(request, SESSION_COOKIE)
  const { secret } = config(env)
  if (!token || !secret) return null
  try {
    const [ivPart, dataPart] = token.split('.')
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(ivPart) }, await getKey(secret), fromBase64Url(dataPart))
    const payload = JSON.parse(new TextDecoder().decode(decrypted))
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

export const cookie = (name, value, maxAge = 86400) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
export const clearCookie = name => cookie(name, '', 0)

export const getReturnUrl = (env, value) => {
  const { allowedOrigin, returnUrl } = config(env)
  if (!value) return returnUrl
  try {
    const parsed = new URL(value)
    return parsed.origin === allowedOrigin && parsed.pathname.endsWith('/admin.html') ? parsed.toString() : returnUrl
  } catch {
    return returnUrl
  }
}

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
})

export const withCors = (request, env, response) => {
  const origin = request.headers.get('Origin')
  if (origin && origin === config(env).allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  return response
}

export const options = (request, env) => withCors(request, env, new Response(null, { status: 204 }))

export const readJson = async request => {
  const text = await request.text()
  if (text.length > 400000) throw new Error('Request too large')
  return JSON.parse(text || '{}')
}

export const getConfig = env => config(env)
