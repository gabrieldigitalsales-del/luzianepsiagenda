import { authenticated, json } from './_auth.js'
export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, {error:'Método não permitido'})
  return json(res, 200, {authenticated: authenticated(req)})
}
