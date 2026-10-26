import { createClient } from '@supabase/supabase-js'
import { authenticated, json } from './_auth.js'
const aliases={luziane_reabilitar_2026_patients:'agendaluziane_pacientes',luziane_reabilitar_2026_appointments:'agendaluziane_consultas',luziane_reabilitar_2026_packages:'agendaluziane_cobrancas',luziane_reabilitar_2026_payments:'agendaluziane_pagamentos',luziane_reabilitar_2026_settings:'agendaluziane_configuracoes'}
function adapt(table,row){if(!row)return row;const p=row.payload||{};const r={...p,id:row.id,created_at:row.created_at,updated_at:row.updated_at};if(table.endsWith('patients'))r.full_name=p.full_name||row.nome_completo;if(table.endsWith('appointments')){r.patient_id=p.patient_id||row.paciente_id;r.appointment_date=p.appointment_date||row.inicio?.slice(0,10);r.appointment_time=p.appointment_time||row.inicio?.slice(11,16)}if(table.endsWith('packages')){r.patient_id=p.patient_id||row.paciente_id;r.total_amount=p.total_amount??row.valor_total;r.description=p.description||row.descricao;r.due_date=p.due_date||row.vencimento}if(table.endsWith('payments')){r.appointment_id=p.appointment_id||null;r.package_id=p.package_id||null;r.payment_date=p.payment_date||row.data_pagamento;r.amount=p.amount??row.valor;r.payment_method=p.payment_method||row.forma}if(table.endsWith('settings'))r.id='main';return r}
function toDb(table,record){const p={...record};delete p.created_at;delete p.updated_at;delete p.id;if(table.endsWith('patients'))return {nome_completo:p.full_name||'',payload:p};if(table.endsWith('appointments'))return {paciente_id:p.patient_id||null,inicio:`${p.appointment_date}T${String(p.appointment_time||'08:00').slice(0,5)}:00-03:00`,payload:p};if(table.endsWith('packages'))return {paciente_id:p.patient_id,tipo:p.type==='sessao'?'sessao':p.type==='avaliacao'?'avaliacao':'pacote',descricao:p.description||'',valor_total:Number(p.total_amount||0),vencimento:p.due_date||null,payload:p};if(table.endsWith('settings'))return {id:'principal',nome_clinica:p.clinic_name||'Reabilitar Psicologia',payload:p};if(table.endsWith('payments'))return {data_pagamento:p.payment_date,valor:Number(p.amount),forma:p.payment_method||'pix',payload:p};throw new Error('Tabela inválida')}
function filtered(rows,filters){return rows.filter(row=>filters.every(f=>f.op==='in'?Array.isArray(f.value)&&f.value.includes(row[f.field]):String(row[f.field]??'')===String(f.value??'')))}
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
 if(!authenticated(req))return json(res,401,{error:'Acesso não autorizado'});
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return json(res,503,{error:'Banco não configurado'});
 const {table,method='list',filters=[],orders=[],single=false,values}=req.body||{};
 if(!Object.hasOwn(aliases,table)||!['list','insert','update','delete','upsert'].includes(method)||!Array.isArray(filters)||filters.length>10||!Array.isArray(orders))return json(res,400,{error:'Requisição inválida'});
 try{
 const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{db:{schema:'public'},auth:{persistSession:false,autoRefreshToken:false}}),name=aliases[table];
 const {data,error}=await db.from(name).select('*').limit(10000);if(error)throw error;
 const chosen=filtered((data||[]).map(row=>adapt(table,row)),filters);
 if(method==='list'){for(const o of [...orders].reverse())chosen.sort((a,b)=>String(a[o.field]||'').localeCompare(String(b[o.field]||''))*(o.ascending===false?-1:1));return json(res,200,{data:single?chosen[0]||null:chosen})}
 if(['delete','update'].includes(method)&&(!filters.length||(chosen.length!==1&&table!=='luziane_reabilitar_2026_appointments')))return json(res,400,{error:'Filtro preciso obrigatório'});
 if(method==='delete'){const ids=chosen.map(x=>x.id);if(ids.length){const d=await db.from(name).delete().in('id',ids);if(d.error)throw d.error}return json(res,200,{data:[]})}
 let inputs=Array.isArray(values)?values:[values];
 if(inputs.length>100||inputs.some(x=>!x||typeof x!=='object'))return json(res,400,{error:'Dados inválidos'});
 if(method==='upsert')inputs=inputs.map(x=>({...x,id:'principal'}));
 if(method==='update')inputs=inputs.map(x=>({...x,id:chosen[0]?.id}));
 const results=[];
 for(const value of inputs){
 const row=toDb(table,value);
 if(table.endsWith('payments')){
 const cr=await db.from('agendaluziane_cobrancas').select('id,consulta_id').limit(10000);if(cr.error)throw cr.error;
 let charge=(cr.data||[]).find(c=>value.package_id?c.id===value.package_id:c.consulta_id===value.appointment_id);
 if(!charge&&value.appointment_id){
 const a=await db.from('agendaluziane_consultas').select('*').eq('id',value.appointment_id).single();if(a.error)throw a.error;
 const av=adapt('luziane_reabilitar_2026_appointments',a.data);
 const inserted=await db.from('agendaluziane_cobrancas').insert({paciente_id:av.patient_id,consulta_id:value.appointment_id,tipo:'sessao',valor_total:Number(av.price||0),descricao:av.service_type||'Sessão',payload:{internal_session:true}}).select().single();if(inserted.error)throw inserted.error;charge=inserted.data;
 }if(!charge)throw new Error('Cobrança não encontrada');row.cobranca_id=charge.id;
 }
 let out;
 if(method==='insert')out=await db.from(name).insert(row).select().single();
 else if(method==='upsert')out=await db.from(name).upsert(row,{onConflict:'id'}).select().single();
 else out=await db.from(name).update(row).eq('id',value.id).select().single();
 if(out.error)throw out.error;results.push(adapt(table,out.data));
 }
 return json(res,200,{data:single?results[0]:results});
 }catch(e){console.error('Luziane API:',e);return json(res,500,{error:'Falha ao gravar ou consultar no banco'})}
}
