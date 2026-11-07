import { json, options, withCors } from '../_lib/auth.js'

const retired = (request, env) => withCors(request, env, json({
  error: 'Standalone image uploads are retired. Images are now staged locally and published atomically with the article.'
}, 410))

export async function onRequestOptions({ request, env }) { return options(request, env) }
export async function onRequestGet({ request, env }) { return retired(request, env) }
export async function onRequestPost({ request, env }) { return retired(request, env) }
