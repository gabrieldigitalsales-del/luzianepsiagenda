import { verifyPassword, issueSession, json } from './_auth.js'
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido'})
 try{
 if(!await verifyPassword(req.body?.password))return json(res,401,{error:'Senha incorreta'})
 issueSession(res);return json(res,200,{ok:true})
 }catch(err){console.error('Erro no login:',err);return json(res,500,{error:'Não foi possível consultar as credenciais'})}
}
