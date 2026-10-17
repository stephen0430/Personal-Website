import { json, options, readSession, withCors } from '../../_lib/auth.js'

export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestGet({ request, env }) {
  const session = await readSession(env, request)
  return withCors(request, env, session ? json({ authenticated: true, login: session.login }) : json({ authenticated: false }, 401))
}
