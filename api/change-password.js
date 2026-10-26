import { authenticated, verifyPassword, passwordHash, db, issueSession, json } from './_auth.js'
import { randomBytes } from 'node:crypto'
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido'})
 if(!authenticated(req))return json(res,401,{error:'Sessão expirada. Entre novamente.'})
 const {currentPassword,newPassword,confirmPassword}=req.body||{}
 if(typeof newPassword!=='string'||newPassword.length<8||newPassword.length>128)return json(res,400,{error:'Use uma senha com pelo menos 8 caracteres.'})
 if(newPassword!==confirmPassword)return json(res,400,{error:'A confirmação da senha está diferente.'})
 try{
 if(!await verifyPassword(currentPassword))return json(res,403,{error:'A senha atual está incorreta.'})
 const client=db()
 const {data,error}=await client.from('agendaluziane_configuracoes').select('*').eq('id','principal').maybeSingle()
 if(error)throw error
 const salt=randomBytes(20).toString('hex')
 const payload={...(data?.payload||{}),__auth:{salt,hash:passwordHash(newPassword,salt)}}
 const updated=await client.from('agendaluziane_configuracoes').upsert({id:'principal',nome_clinica:data?.nome_clinica||'Reabilitar Psicologia',payload},{onConflict:'id'})
 if(updated.error)throw updated.error
 issueSession(res)
 return json(res,200,{ok:true})
 }catch(err){console.error('Erro ao alterar senha',err);return json(res,500,{error:'Não foi possível salvar a nova senha.'})}
}
