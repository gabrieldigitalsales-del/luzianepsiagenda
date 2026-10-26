import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
const COOKIE = 'reabilitar_session'
const MAX_AGE = 60 * 60 * 8
// APENAS PARA TESTES: chave fixa no código, sem variáveis de ambiente.
const DEMO_SESSION_SECRET = '432f6140c9f82687c941f43db6f12ac5ca65b57b7192e33c73e9e59720db904d'
function secret() { return DEMO_SESSION_SECRET }
function hash(value) { return createHmac('sha256', secret()).update(value).digest('hex') }
function safeEq(a, b) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
// Senha de demonstração solicitada. Não usar com dados reais de pacientes.
export function verifyPassword(input) {
  return typeof input === 'string' && safeEq(input, 'asd123')
}
export function issueSession(res) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE
  const nonce = randomBytes(12).toString('hex')
  const payload = `${expires}.${nonce}`
  const token = `${payload}.${hash(payload)}`
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`)
}
export function authenticated(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))
  if (!cookie || !secret()) return false
  const token = cookie.slice(COOKIE.length + 1)
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [exp, nonce, mac] = parts
  if (!/^\d+$/.test(exp) || !/^[a-f0-9]{24}$/.test(nonce) || Number(exp) <= Date.now() / 1000) return false
  return safeEq(hash(`${exp}.${nonce}`), mac)
}
export function clearSession(res) { res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`) }
export function json(res, status, body) { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) }
