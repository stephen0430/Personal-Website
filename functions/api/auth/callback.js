import { STATE_COOKIE, SESSION_COOKIE, cookie, clearCookie, createSession, getReturnUrl, readCookie, getConfig } from '../../_lib/auth.js'

const fail = (returnUrl, reason, headers = {}) => {
  const destination = new URL(returnUrl)
  destination.searchParams.set('auth', 'error')
  destination.searchParams.set('reason', reason)
  return new Response(null, { status: 302, headers: { Location: destination.toString(), ...headers } })
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const stateCookie = readCookie(request, STATE_COOKIE)
  let saved = {}
  try { saved = JSON.parse(atob(stateCookie)) } catch {}
  const returnUrl = getReturnUrl(env, saved.returnUrl)
  const clearState = { 'Set-Cookie': clearCookie(STATE_COOKIE) }
  const oauthError = url.searchParams.get('error')
  if (oauthError) return fail(returnUrl, 'oauth_denied', clearState)
  if (!stateCookie || !saved.state || !saved.codeVerifier) return fail(returnUrl, 'state_cookie_missing', clearState)
  if (!url.searchParams.get('state') || url.searchParams.get('state') !== saved.state) return fail(returnUrl, 'state_mismatch', clearState)
  if (!url.searchParams.get('code')) return fail(returnUrl, 'authorization_code_missing', clearState)

  const missing = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL', 'SESSION_SECRET'].filter(key => !env[key])
  if (missing.length) {
    console.error('GitHub OAuth callback missing configuration', { missing })
    return fail(returnUrl, missing.includes('SESSION_SECRET') ? 'session_secret_missing' : 'oauth_config_missing', clearState)
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: env.GITHUB_CALLBACK_URL, code_verifier: saved.codeVerifier })
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || !token.access_token) {
      console.error('GitHub OAuth token exchange failed', { status: tokenResponse.status, error: token.error || 'missing_access_token' })
      return fail(returnUrl, 'token_exchange_failed', clearState)
    }
    const userResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'X-GitHub-Api-Version': '2022-11-28' } })
    const user = await userResponse.json()
    if (!userResponse.ok || !user.login) {
      console.error('GitHub OAuth user lookup failed', { status: userResponse.status })
      return fail(returnUrl, 'github_profile_failed', clearState)
    }
    if (user.login !== getConfig(env).allowedLogin) return fail(returnUrl, 'github_account_not_allowed', clearState)
    let session
    try {
      session = await createSession(env, { login: user.login, accessToken: token.access_token })
    } catch (error) {
      console.error('GitHub OAuth session creation failed', { message: error.message })
      return fail(returnUrl, 'session_creation_failed', clearState)
    }
    const response = new Response(null, { status: 302, headers: { Location: `${returnUrl}?auth=success` } })
    response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, session))
    response.headers.append('Set-Cookie', clearCookie(STATE_COOKIE))
    return response
  } catch (error) {
    console.error('GitHub OAuth callback unexpected error', { message: error.message })
    return fail(returnUrl, 'callback_internal_error', clearState)
  }
}
