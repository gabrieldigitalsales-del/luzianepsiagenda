import { clearSession, json } from './_auth.js'
export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error:'Método não permitido'})
  clearSession(res)
  return json(res, 200, {ok:true})
}
