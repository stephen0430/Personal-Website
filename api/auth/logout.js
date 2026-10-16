import { SESSION_COOKIE, clearCookie, json, setCors } from '../../lib/auth.mjs'

export default function handler(req, res) {
  if (setCors(req, res)) return
  res.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE))
  return json(res, 200, { ok: true })
}
