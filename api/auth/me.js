import { json, readSession, setCors } from '../../lib/auth.mjs'

export default function handler(req, res) {
  if (setCors(req, res)) return
  const session = readSession(req)
  if (!session) return json(res, 401, { authenticated: false })
  return json(res, 200, { authenticated: true, login: session.login })
}
