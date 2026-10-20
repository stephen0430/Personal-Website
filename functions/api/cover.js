import { json, options, readSession, withCors } from '../_lib/auth.js'

const repository = 'stephen0430/Personal-Website'
const formats = {
  'image/jpeg': { extension: 'jpg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: bytes => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) },
  'image/webp': { extension: 'webp', signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
  'image/gif': { extension: 'gif', signature: bytes => ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6))) }
}
const maxBytes = 3 * 1024 * 1024
export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestPost({ request, env }) {
  const session = await readSession(env, request)
  if (!session || session.login !== (env.ALLOWED_GITHUB_LOGIN || 'stephen0430')) return withCors(request, env, json({ error: 'GitHub login required' }, 401))
  try {
    const raw = await request.text()
    if (raw.length > 4_300_000) return withCors(request, env, json({ error: 'Image too large (maximum 3 MB)' }, 413))
    const { type, data } = JSON.parse(raw)
    const format = formats[type]
    if (!format || typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 4_200_000) return withCors(request, env, json({ error: 'Invalid image format or size' }, 400))
    const binary = atob(data)
    if (!binary.length || binary.length > maxBytes || !format.signature(Uint8Array.from(binary, char => char.charCodeAt(0)).slice(0, 12))) return withCors(request, env, json({ error: 'Invalid image content or size' }, 400))
    const path = `assets/covers/${crypto.randomUUID()}.${format.extension}`
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.accessToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'QXY-Web-Publisher', 'Content-Type': 'application/json' }
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Add article cover: ${path}`, content: data, branch: 'main' })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return withCors(request, env, json({ error: result.message || `GitHub upload failed (HTTP ${response.status})` }, response.status))
    return withCors(request, env, json({ ok: true, path: `/${path}` }))
  } catch (error) {
    return withCors(request, env, json({ error: error.message || 'Cover upload failed' }, 500))
  }
}
