import { STATE_COOKIE, cookie, getReturnUrl } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const clientId = env.GITHUB_CLIENT_ID
  const callbackUrl = env.GITHUB_CALLBACK_URL
  if (!clientId || !callbackUrl) return new Response('GitHub OAuth is not configured', { status: 500 })
  const randomBytes = length => {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  }
  const state = randomBytes(24)
  const codeVerifier = randomBytes(48)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const incoming = new URL(request.url)
  const returnUrl = getReturnUrl(env, incoming.searchParams.get('return'))
  const stateValue = btoa(JSON.stringify({ state, codeVerifier, returnUrl }))
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, scope: 'public_repo read:user', state, code_challenge: codeChallenge, code_challenge_method: 'S256' })
  return new Response(null, { status: 302, headers: { Location: `https://github.com/login/oauth/authorize?${params}`, 'Set-Cookie': cookie(STATE_COOKIE, stateValue, 600) } })
}
