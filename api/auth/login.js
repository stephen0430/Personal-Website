import crypto from 'node:crypto'
import { STATE_COOKIE, cookie, getReturnUrl } from '../../lib/auth.mjs'

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const callbackUrl = process.env.GITHUB_CALLBACK_URL
  if (!clientId || !callbackUrl) {
    res.statusCode = 500
    res.end('GitHub OAuth is not configured')
    return
  }
  const state = crypto.randomBytes(24).toString('hex')
  const codeVerifier = crypto.randomBytes(48).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  const returnUrl = getReturnUrl(req.query?.return)
  const stateValue = Buffer.from(JSON.stringify({ state, codeVerifier, returnUrl })).toString('base64url')
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl, scope: 'public_repo read:user', state, code_challenge: codeChallenge, code_challenge_method: 'S256' })
  res.writeHead(302, {
    Location: `https://github.com/login/oauth/authorize?${params}`,
    'Set-Cookie': cookie(STATE_COOKIE, stateValue, 600)
  })
  res.end()
}
