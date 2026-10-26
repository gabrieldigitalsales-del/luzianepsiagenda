import { createHmac, timingSafeEqual, randomBytes, pbkdf2Sync } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const COOKIE='reabilitar_session', MAX_AGE=60*60*8
const DEMO_SESSION_SECRET='432f6140c9f82687c941f43db6f12ac5ca65b57b7192e33c73e9e59720db904d'
const secret=()=>process.env.SESSION_SECRET||DEMO_SESSION_SECRET
function safeEq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
function sign(s){return createHmac('sha256',secret()).update(s).digest('hex')}
export function passwordHash(p,salt){return pbkdf2Sync(p,salt,210000,32,'sha256').toString('hex')}
export function db(){return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{db:{schema:'public'},auth:{persistSession:false,autoRefreshToken:false}})}
export async function getStoredCredential(){
 const {data,error}=await db().from('agendaluziane_configuracoes').select('payload').eq('id','principal').maybeSingle()
 if(error)throw error
 return data?.payload?.__auth||null
}
export async function verifyPassword(input){
 if(typeof input!=='string')return false
 const saved=await getStoredCredential()
 if(!saved)return safeEq(input,'asd123')
 return typeof saved.salt==='string'&&typeof saved.hash==='string'&&safeEq(passwordHash(input,saved.salt),saved.hash)
}
export function issueSession(res){
 const exp=Math.floor(Date.now()/1000)+MAX_AGE,nonce=randomBytes(12).toString('hex'),payload=`${exp}.${nonce}`
 res.setHeader('Set-Cookie',`${COOKIE}=${payload}.${sign(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`)
}
export function authenticated(req){
 const c=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))
 if(!c)return false
 const token=c.slice(COOKIE.length+1).split('.')
 return token.length===3&&/^\d+$/.test(token[0])&&/^[a-f0-9]{24}$/.test(token[1])&&Number(token[0])>Date.now()/1000&&safeEq(sign(`${token[0]}.${token[1]}`),token[2])
}
export function clearSession(res){res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`)}
export function json(res,status,body){res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body))}
