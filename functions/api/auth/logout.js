import { SESSION_COOKIE, clearCookie, json, options, withCors } from '../../_lib/auth.js'

export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestPost({ request, env }) {
  const response = json({ ok: true })
  response.headers.set('Set-Cookie', clearCookie(SESSION_COOKIE))
  return withCors(request, env, response)
}
