import { STATE_COOKIE, SESSION_COOKIE, cookie, clearCookie, createSession, getReturnUrl, readCookie } from '../../lib/auth.mjs'

export default async function handler(req, res) {
  const stateCookie = readCookie(req, STATE_COOKIE)
  let saved = {}
  try { saved = JSON.parse(Buffer.from(stateCookie, 'base64url').toString('utf8')) } catch {}
  const returnUrl = getReturnUrl(saved.returnUrl)
  if (!req.query?.code || !req.query?.state || req.query.state !== saved.state) {
    res.writeHead(302, { Location: `${returnUrl}?auth=error`, 'Set-Cookie': clearCookie(STATE_COOKIE) })
    res.end()
    return
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code, redirect_uri: process.env.GITHUB_CALLBACK_URL, code_verifier: saved.codeVerifier })
    })
    const token = await tokenResponse.json()
    if (!token.access_token) throw new Error('GitHub OAuth token exchange failed')
    const userResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'X-GitHub-Api-Version': '2022-11-28' } })
    const user = await userResponse.json()
    if (!user.login || user.login !== (process.env.ALLOWED_GITHUB_LOGIN || 'stephen0430')) throw new Error('GitHub account is not allowed')
    const session = createSession({ login: user.login, accessToken: token.access_token })
    res.writeHead(302, { Location: `${returnUrl}?auth=success`, 'Set-Cookie': [cookie(SESSION_COOKIE, session), clearCookie(STATE_COOKIE)] })
    res.end()
  } catch {
    res.writeHead(302, { Location: `${returnUrl}?auth=error`, 'Set-Cookie': clearCookie(STATE_COOKIE) })
    res.end()
  }
}
