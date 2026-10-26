import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import login from './api/login.js'
import session from './api/session.js'
import logout from './api/logout.js'

// Em desenvolvimento local, o Vite atende as mesmas rotas de API da Vercel.
function localLoginApi() {
  const handlers = {'/api/login': login, '/api/session': session, '/api/logout': logout}
  return {
    name: 'reabilitar-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        const handler = handlers[path]
        if (!handler) return next()
        try {
          if (req.method === 'POST') {
            let raw = ''
            for await (const part of req) {
              raw += part
              if (raw.length > 10000) { res.statusCode = 413; res.end('Corpo muito grande'); return }
            }
            try { req.body = JSON.parse(raw || '{}') }
            catch { res.statusCode = 400; res.end('JSON inválido'); return }
          }
          handler(req, res)
        } catch (err) {
          console.error('Erro no login local:', err)
          if (!res.headersSent) res.statusCode = 500
          res.end(JSON.stringify({ error: 'Erro interno no servidor' }))
        }
      })
    }
  }
}
export default defineConfig({plugins:[react(),localLoginApi()]})
