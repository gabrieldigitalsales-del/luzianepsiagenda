import { verifyPassword, issueSession, json } from './_auth.js'
export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error:'Método não permitido'})
  const pass = req.body?.password
  if (!verifyPassword(pass)) return json(res, 401, {error:'Credenciais inválidas'})
  issueSession(res)
  return json(res, 200, {ok:true})
}
