// Banco acessível somente pelo backend autenticado. Sem fallback local silencioso.
export const hasSupabase = true
const allowed = ['luziane_reabilitar_2026_patients','luziane_reabilitar_2026_appointments','luziane_reabilitar_2026_settings','luziane_reabilitar_2026_packages','luziane_reabilitar_2026_payments']
function query(table) {
  const opts={table,method:'list',filters:[],orders:[]}
  const q={
    select(){return q},
    order(field,config){opts.orders.push({field,ascending:config?.ascending!==false});return q},
    eq(field,value){opts.filters.push({field,op:'eq',value});return q},
    in(field,value){opts.filters.push({field,op:'in',value});return q},
    maybeSingle(){opts.single=true;return q},single(){opts.single=true;return q},
    insert(values){opts.method='insert';opts.values=values;return q},
    update(values){opts.method='update';opts.values=values;return q},
    delete(){opts.method='delete';return q},
    upsert(values){opts.method='upsert';opts.values=values;return q},
    async then(resolve,reject){
      try{
        const response=await fetch('/api/data',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(opts)})
        const body=await response.json()
        return resolve(response.ok?{data:body.data,error:null}:{data:null,error:{message:body.error||'Falha no servidor'}})
      }catch(error){return resolve({data:null,error:{message:error.message}})}
    }
  }
  return q
}
export const supabase={from(table){if(!allowed.includes(table))throw new Error('Tabela não autorizada');return query(table)}}
