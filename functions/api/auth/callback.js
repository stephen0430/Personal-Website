import { STATE_COOKIE, SESSION_COOKIE, cookie, clearCookie, createSession, getReturnUrl, readCookie, getConfig } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const stateCookie = readCookie(request, STATE_COOKIE)
  let saved = {}
  try { saved = JSON.parse(atob(stateCookie)) } catch {}
  const returnUrl = getReturnUrl(env, saved.returnUrl)
  if (!url.searchParams.get('code') || !url.searchParams.get('state') || url.searchParams.get('state') !== saved.state) {
    return new Response(null, { status: 302, headers: { Location: `${returnUrl}?auth=error`, 'Set-Cookie': clearCookie(STATE_COOKIE) } })
  }
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: env.GITHUB_CALLBACK_URL, code_verifier: saved.codeVerifier })
    })
    const token = await tokenResponse.json()
    if (!token.access_token) throw new Error('GitHub OAuth token exchange failed')
    const userResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'X-GitHub-Api-Version': '2022-11-28' } })
    const user = await userResponse.json()
    if (!user.login || user.login !== getConfig(env).allowedLogin) throw new Error('GitHub account is not allowed')
    const session = await createSession(env, { login: user.login, accessToken: token.access_token })
    const response = new Response(null, { status: 302, headers: { Location: `${returnUrl}?auth=success` } })
    response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, session))
    response.headers.append('Set-Cookie', clearCookie(STATE_COOKIE))
    return response
  } catch {
    return new Response(null, { status: 302, headers: { Location: `${returnUrl}?auth=error`, 'Set-Cookie': clearCookie(STATE_COOKIE) } })
  }
}
