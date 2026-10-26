import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CalendarDays, Clock3, Edit3, LogOut, MapPin, Phone, Plus, Save, Search, Settings, Sun, Trash2, UsersRound, History, ChevronLeft, ChevronRight, Download, Printer, X, MessageCircle, AlertTriangle, WalletCards, Repeat2, CheckCircle2, BarChart3, TrendingUp, CircleDollarSign } from 'lucide-react'
import { hasSupabase, supabase } from './supabaseClient'
import './styles.css'


/** Janela modal interna. Não usa alert(), confirm() nem prompt() do navegador. */
function customDialog(message,kind='notice',defaultValue=''){
 return new Promise(resolve=>{
   const host=document.createElement('div');host.className='luz-dialog-host';document.body.appendChild(host);
   const root=createRoot(host);
   const close=value=>{root.unmount();host.remove();resolve(value)};
   function Dialog(){
     const [value,setValue]=React.useState(defaultValue);
     const isConfirm=kind==='confirm',isPrompt=kind==='prompt';
     return <div className="luz-dialog-backdrop" role="presentation">
       <section className="luz-dialog-panel" role="dialog" aria-modal="true" aria-label={isConfirm?'Confirmação':isPrompt?'Escolher opção':'Aviso'}>
         <div className="luz-dialog-mark"><AlertTriangle size={22}/></div>
         <h2>{isConfirm?'Confirmar ação':isPrompt?'Escolha uma opção':'Agenda Luziane'}</h2>
         <p>{String(message)}</p>
         {isPrompt&&<input autoFocus value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')close(value);if(e.key==='Escape')close(null)}}/>}
         <div className="luz-dialog-buttons">
           {(isConfirm||isPrompt)&&<button type="button" onClick={()=>close(isConfirm?false:null)}>Cancelar</button>}
           <button type="button" className="luz-dialog-primary" autoFocus={!isPrompt} onClick={()=>close(isConfirm?true:isPrompt?value:undefined)}>{isConfirm?'Confirmar':isPrompt?'Continuar':'Entendi'}</button>
         </div>
       </section>
     </div>
   }
   root.render(<Dialog/>);
 });
}
const alert=message=>customDialog(message,'notice');
const confirm=message=>customDialog(message,'confirm');
const prompt=(message,value='')=>customDialog(message,'prompt',value);

const today = new Date()
const isoToday = toISODate(today)
const seedPatients = []
const seedAppointments = []
const seedPayments = []
const defaultSettings = { id: 'main', clinic_name: 'LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA', start_time: '08:00', end_time: '18:00', default_duration: 50, default_price: '' }

function toISODate(date) {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function dateFromISO(iso){ return new Date(`${iso}T12:00:00`) }
function niceDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromISO(date)).replace(/^./, c => c.toUpperCase()).replace('-feira', '-Feira')
}
function monthTitle(date) { return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date).replace(/^./, c => c.toUpperCase()) }
function uid(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}` }
function loadLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
function saveLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)) }
function normalizePhone(phone='') { return String(phone).replace(/\D/g, '') }
function whatsappUrl(phone, appointment = null, fallbackName = 'paciente') {
  const digits = normalizePhone(phone)
  if (!digits) return null
  const br = digits.startsWith('55') ? digits : `55${digits}`
  const patientName = appointment?.patient_name || appointment?.patient_name_snapshot || fallbackName || 'paciente'
  const dateText = appointment?.appointment_date ? formatDateBR(appointment.appointment_date) : ''
  const timeText = appointment?.appointment_time ? ` às ${String(appointment.appointment_time).slice(0,5)}` : ''
  const text = appointment
    ? `Oi *${patientName}*, sua consulta com Luziane Muzzi Lage está marcada para o dia *${dateText}${timeText}*. Podemos confirmar?`
    : `Oi *${patientName}*, tudo bem?`
  return `https://wa.me/${br}?text=${encodeURIComponent(text)}`
}
function formatDateBR(iso){ return new Intl.DateTimeFormat('pt-BR').format(dateFromISO(iso)) }
function money(value){ return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(value || 0)) }
function monthKeyFromISO(iso){ return String(iso || '').slice(0,7) }
function currentMonthKey(){ return isoToday.slice(0,7) }
function monthLabelFromKey(key){ if(!key) return 'Todos os meses'; const [y,m]=key.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month:'long', year:'numeric' }).format(new Date(y, m-1, 1)).replace(/^./, c=>c.toUpperCase()) }
function cleanForSupabase(record) {
  const clean = { ...record }
  delete clean.created_at
  delete clean.updated_at
  Object.keys(clean).forEach((key) => { if (clean[key] === '') clean[key] = null })
  return clean
}
function toNumberZero(value) {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function addRecurrenceDate(iso, frequency, index) {
  const d = dateFromISO(iso)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * index)
  if (frequency === 'biweekly') d.setDate(d.getDate() + 14 * index)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + index)
  return toISODate(d)
}
function makeRecurringAppointments(record, opts) {
  const repeat = opts?.repeat || 'none'
  const count = Math.max(1, toNumberZero(opts?.count || 1))
  if (repeat === 'none' || count <= 1 || record.id) return [record]
  const groupId = uid('rec')
  return Array.from({ length: count }, (_, i) => ({
    ...record,
    id: undefined,
    appointment_date: addRecurrenceDate(record.appointment_date, repeat, i),
    recurrence_group_id: groupId,
    recurrence_frequency: repeat,
    recurrence_index: i + 1,
    recurrence_total: count,
    recurrence_original_date: record.appointment_date
  }))
}
function showSupabaseError(action, error) { console.error(action, error); alert(`${action}: ${error?.message || 'erro desconhecido'}`) }

function SplashScreen() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const timer = window.setInterval(() => {
      const next = Math.min(100, Math.round((Date.now() - start) / 12))
      setProgress(next)
      if (next >= 100) window.clearInterval(timer)
    }, 35)
    return () => window.clearInterval(timer)
  }, [])
  return <main className="splash-screen" role="status" aria-label="Carregando agenda Reabilitar">
    <div className="splash-accent" />
    <div className="splash-center">
      <div className="splash-logo-frame"><img src="/logo-reabilitar.png" alt="Reabilitar Psicologia" /></div>
      <div className="splash-title">LUZIANE MUZZI LAGE</div>
      <div className="splash-subtitle">REABILITAR PSICOLOGIA</div>
      <div className="splash-divider" />
      <p>Preparando sua agenda</p>
      <div className="splash-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="splash-percentage">{progress}%</span>
    </div>
    <div className="splash-credit">CRIADO POR <strong>NEXOR</strong></div>
  </main>
}

function App() {
  const [logged, setLogged] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  useEffect(() => {
    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : { authenticated: false })
      .then(data => setLogged(Boolean(data.authenticated)))
      .catch(() => setLogged(false))
      .finally(() => setChecking(false))
  }, [])
  useEffect(() => {
    if (!showSplash) return
    const timer = window.setTimeout(() => setShowSplash(false), 1350)
    return () => window.clearTimeout(timer)
  }, [showSplash])
  if (checking || showSplash) return <SplashScreen />
  if (!logged) return <Login onOk={() => { setLogged(true); setShowSplash(true) }} />
  return <AgendaApp onLogout={async () => { try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }) } finally { setLogged(false) } }} />
}
function Login({ onOk }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const response = await fetch('/api/login', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pass }) })
      if (response.ok) onOk()
      else setErr(response.status === 401 ? 'Senha incorreta' : 'Não foi possível autenticar. Verifique se está executando a versão atualizada do projeto.')
    } catch { setErr('Servidor indisponível. Rode pela Vercel ou configure as funções locais.') }
    finally { setBusy(false) }
  }
  return <main className="login-screen"><form className="login-card" onSubmit={submit}><img className="login-brand-img" src="/logo-reabilitar.png" alt="Reabilitar Psicologia"/><div className="brand-login">LUZIANE MUZZI LAGE<br/>REABILITAR PSICOLOGIA</div><p>Acesse sua agenda</p><input autoFocus type="password" autoComplete="current-password" placeholder="Digite a senha" value={pass} onChange={e=>setPass(e.target.value)} />{err && <span className="error">{err}</span>}<button disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button></form></main>
}

function AgendaApp({ onLogout }) {
  const [tab, setTab] = useState('hoje')
  const [patients, setPatients] = useState(seedPatients)
  const [appointments, setAppointments] = useState(seedAppointments)
  const [payments, setPayments] = useState(seedPayments)
  const [packages, setPackages] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [selectedDate, setSelectedDate] = useState(isoToday)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const [p,a,st,pay,packs]=await Promise.all([
        supabase.from('luziane_reabilitar_2026_patients').select('*').order('created_at',{ascending:true}),
        supabase.from('luziane_reabilitar_2026_appointments').select('*').order('appointment_date',{ascending:true}).order('appointment_time',{ascending:true}),
        supabase.from('luziane_reabilitar_2026_settings').select('*').eq('id','main').maybeSingle(),
        supabase.from('luziane_reabilitar_2026_payments').select('*').order('payment_date',{ascending:false}),
        supabase.from('luziane_reabilitar_2026_packages').select('*').order('created_at',{ascending:false})
      ])
      for(const r of [p,a,st,pay,packs])if(r.error)throw new Error(r.error.message)
      setPatients(p.data||[]);setAppointments(a.data||[]);setSettings(st.data||defaultSettings)
      setPayments(pay.data||[]);setPackages(packs.data||[])
    }catch(error){console.error('Erro na leitura da agenda',error);alert('Não foi possível acessar o banco: '+error.message)}
    finally{setLoading(false)}
  }
  useEffect(() => { refresh() }, [])

  async function savePackage(data) {
    if (!data.patient_id || !data.description?.trim() || !(Number(data.total_amount)>0)) { alert('Selecione paciente, descrição e valor positivo.'); return }
    const record = {...data, total_amount:Number(data.total_amount), description:data.description.trim()}
    if(hasSupabase){
      const payload=cleanForSupabase(record)
      const query=payload.id ? supabase.from('luziane_reabilitar_2026_packages').update((({id,...rest})=>rest)(payload)).eq('id',payload.id) : supabase.from('luziane_reabilitar_2026_packages').insert(payload)
      const {error}=await query
      if(error){showSupabaseError('Erro ao salvar pacote',error);return}
      await refresh()
    }else{
      const list=record.id ? packages.map(x=>x.id===record.id?record:x) : [...packages,{...record,id:uid('pkg')}]
      setPackages(list);saveLocal('luziane_packages',list)
    }
    setModal(null)
  }
  async function deletePackage(pkg){
    if(payments.some(p=>p.package_id===pkg.id)){alert('Este pacote tem recebimentos. Remova os recebimentos antes de excluir.');return}
    if(!await confirm('Excluir esta cobrança?'))return
    if(hasSupabase){const {error}=await supabase.from('luziane_reabilitar_2026_packages').delete().eq('id',pkg.id);if(error){showSupabaseError('Erro ao excluir cobrança',error);return}await refresh()}
    else{const list=packages.filter(p=>p.id!==pkg.id);setPackages(list);saveLocal('luziane_packages',list)}
  }
  async function savePayment(data) {
    const isPack=Boolean(data.package_id)
    const target=isPack?packages.find(x=>x.id===data.package_id):appointments.find(x=>x.id===data.appointment_id)
    if (!target || !data.payment_date || !(Number(data.amount)>0)) { alert('Selecione a consulta ou o pacote, data e valor positivo.'); return }
    const previous=payments.filter(p=>(isPack?p.package_id===target.id:p.appointment_id===target.id) && p.id!==data.id).reduce((v,p)=>v+Number(p.amount||0),0)
    const total=Number(isPack?target.total_amount:target.price)||0
    if (previous+Number(data.amount)>total+0.005){alert('O total recebido não pode superar o valor combinado.');return}
    const {_type,...values}=data;const record={...values,appointment_id:isPack?null:target.id,package_id:isPack?target.id:null,amount:Number(data.amount)}
    if(hasSupabase){
      const payload=cleanForSupabase(record)
      const result=payload.id ? await supabase.from('luziane_reabilitar_2026_payments').update((({id,...rest})=>rest)(payload)).eq('id',payload.id) : await supabase.from('luziane_reabilitar_2026_payments').insert(payload)
      if(result.error){showSupabaseError('Erro ao salvar pagamento',result.error);return}
      await refresh()
    }else{
      const list=record.id ? payments.map(p=>p.id===record.id?record:p) : [...payments,{...record,id:uid('pay')}]
      setPayments(list);saveLocal('luziane_payments',list)
    }
    setModal(null)
  }
  async function deletePayment(payment) {
    if(!await confirm('Excluir este recebimento?'))return
    if(hasSupabase){const {error}=await supabase.from('luziane_reabilitar_2026_payments').delete().eq('id',payment.id);if(error){showSupabaseError('Erro ao excluir pagamento',error);return}await refresh()}
    else {const list=payments.filter(p=>p.id!==payment.id);setPayments(list);saveLocal('luziane_payments',list)}
  }
  async function savePatient(data) {
    const record = { ...data, full_name: (data.full_name || '').trim(), status: data.status || 'ativo' }
    if (!record.full_name) { alert('Digite o nome do paciente.'); return }
    if (hasSupabase) {
      const payload = cleanForSupabase(record)
      let result
      if (payload.id) { const { id, ...updatePayload } = payload; result = await supabase.from('luziane_reabilitar_2026_patients').update(updatePayload).eq('id', id).select().single() }
      else result = await supabase.from('luziane_reabilitar_2026_patients').insert(payload).select().single()
      if (result.error) { showSupabaseError('Não foi possível salvar o paciente no Supabase', result.error); return }
      await refresh()
    } else {
      let list = [...patients]; if (record.id) list = list.map(p => p.id === record.id ? record : p); else list.push({ ...record, id: uid('p') })
      setPatients(list); saveLocal('luziane_patients', list)
    }
    setModal(null)
  }
  async function deletePatient(id) {
    if (!await confirm('Excluir paciente? As consultas dele serão mantidas sem vínculo.')) return
    if (hasSupabase) { const { error } = await supabase.from('luziane_reabilitar_2026_patients').delete().eq('id', id); if (error) { alert('Não foi possível excluir o paciente: ' + error.message); return }; await refresh() }
    else { const list = patients.filter(p=>p.id!==id); const listA = appointments.map(a=>a.patient_id===id?{...a,patient_id:null}:a); setPatients(list); setAppointments(listA); saveLocal('luziane_patients', list); saveLocal('luziane_appointments', listA) }
  }
  function detectConflicts(records) {
    return records.filter(r => appointments.some(a => a.id !== r.id && a.appointment_date === r.appointment_date && String(a.appointment_time).slice(0,5) === String(r.appointment_time).slice(0,5) && !['cancelada'].includes(a.status)))
  }
  async function saveAppointment(data, recurrenceOpts={repeat:'none', count:1}) {
    const patient = patients.find(p => p.id === data.patient_id)
    const record = {
      ...data,
      patient_id: data.patient_id || null,
      patient_name: patient?.full_name || data.patient_name || '',
      patient_phone: patient?.phone || data.patient_phone || '',
      patient_name_snapshot: patient?.full_name || data.patient_name || '',
      patient_phone_snapshot: patient?.phone || data.patient_phone || '',
      price: nullableNumber(data.price),
      duration_minutes: toNumberZero(data.duration_minutes),
      status: data.status || 'agendada',
      payment_status: data.payment_status || 'pendente',
      service_type: data.service_type || 'Avaliação'
    }
    if (!record.patient_name) { alert('Selecione ou cadastre um paciente antes de salvar a consulta.'); return }
    if (!record.appointment_date || !record.appointment_time) { alert('Informe data e horário da consulta.'); return }
    const records = makeRecurringAppointments(record, recurrenceOpts)
    const conflicts = detectConflicts(records)
    if (conflicts.length) {
      const msg = conflicts.slice(0,5).map(c => `${formatDateBR(c.appointment_date)} às ${String(c.appointment_time).slice(0,5)}`).join('\n')
      if (!await confirm(`Já existe consulta nesse(s) horário(s):\n${msg}\n\nDeseja salvar mesmo assim?`)) return
    }
    if (hasSupabase) {
      const payloads = records.map(cleanForSupabase)
      let result
      if (record.id) { const { id, ...updatePayload } = payloads[0]; result = await supabase.from('luziane_reabilitar_2026_appointments').update(updatePayload).eq('id', id).select().single() }
      else result = await supabase.from('luziane_reabilitar_2026_appointments').insert(payloads).select()
      if (result.error) { showSupabaseError('Não foi possível salvar a consulta no Supabase', result.error); return }
      await refresh()
    } else {
      let list = [...appointments]
      if (record.id) list = list.map(a => a.id === record.id ? record : a)
      else list.push(...records.map(r => ({ ...r, id: uid('a') })))
      setAppointments(list); saveLocal('luziane_appointments', list)
    }
    setModal(null)
  }
  async function updateRecurringGroup(item, updateData, scope) {
    if (!item.recurrence_group_id || scope === 'one') return saveAppointment({ ...item, ...updateData })
    const targets = appointments.filter(a => a.recurrence_group_id === item.recurrence_group_id && (scope === 'future' ? a.appointment_date >= item.appointment_date : true))
    if (!targets.length) return saveAppointment({ ...item, ...updateData })
    if (!await confirm(`Alterar ${targets.length} consulta(s) desta recorrência?`)) return
    const changedDate = updateData.appointment_date && updateData.appointment_date !== item.appointment_date
    const changedTime = updateData.appointment_time && updateData.appointment_time !== item.appointment_time
    const updates = targets.map(t => ({
      ...t,
      ...updateData,
      id: t.id,
      appointment_date: changedDate ? addRecurrenceDate(updateData.appointment_date, item.recurrence_frequency, Math.max(0, (t.recurrence_index || 1) - (item.recurrence_index || 1))) : t.appointment_date,
      appointment_time: changedTime ? updateData.appointment_time : t.appointment_time,
      patient_name_snapshot: updateData.patient_name || t.patient_name || t.patient_name_snapshot,
      patient_phone_snapshot: updateData.patient_phone || t.patient_phone || t.patient_phone_snapshot
    }))
    if (hasSupabase) {
      for (const rec of updates) { const { id, ...payload } = cleanForSupabase(rec); const { error } = await supabase.from('luziane_reabilitar_2026_appointments').update(payload).eq('id', id); if (error) { showSupabaseError('Erro ao atualizar recorrência', error); return } }
      await refresh()
    } else {
      const ids = new Set(updates.map(u=>u.id)); const map = Object.fromEntries(updates.map(u=>[u.id,u])); const list = appointments.map(a=>ids.has(a.id)?map[a.id]:a); setAppointments(list); saveLocal('luziane_appointments', list)
    }
    setModal(null)
  }
  async function deleteAppointment(item) {
    let ids = [item.id]
    if (item.recurrence_group_id) {
      const scope = await prompt('Esta consulta faz parte de uma recorrência. Digite:\n1 = excluir apenas esta\n2 = esta e próximas\n3 = toda a sequência', '1')
      if (scope === '2') ids = appointments.filter(a=>a.recurrence_group_id===item.recurrence_group_id && a.appointment_date >= item.appointment_date).map(a=>a.id)
      if (scope === '3') ids = appointments.filter(a=>a.recurrence_group_id===item.recurrence_group_id).map(a=>a.id)
    }
    if (!await confirm(`Excluir ${ids.length} consulta(s)?`)) return
    if (hasSupabase) { const { error } = await supabase.from('luziane_reabilitar_2026_appointments').delete().in('id', ids); if (error) { alert('Não foi possível excluir a consulta: ' + error.message); return }; await refresh() }
    else { const set = new Set(ids); const list = appointments.filter(a=>!set.has(a.id)); setAppointments(list); saveLocal('luziane_appointments', list) }
  }
  async function saveSettings(data) {
    const record = { ...settings, ...data, id: 'main', default_duration: toNumberZero(data.default_duration), default_price: nullableNumber(data.default_price) }
    if (hasSupabase) { const { error } = await supabase.from('luziane_reabilitar_2026_settings').upsert(cleanForSupabase(record), { onConflict: 'id' }); if (error) { showSupabaseError('Não foi possível salvar as configurações no Supabase', error); return }; await refresh() }
    else { setSettings(record); saveLocal('luziane_settings', record) }
    alert('Configurações salvas')
  }

  const dayAppointments = appointments.filter(a => a.appointment_date === selectedDate).sort((a,b)=>String(a.appointment_time).localeCompare(String(b.appointment_time)))
  const todayAppointments = appointments.filter(a => a.appointment_date === isoToday).sort((a,b)=>String(a.appointment_time).localeCompare(String(b.appointment_time)))
  const pendingPayments = appointments.filter(a => a.status !== 'cancelada' && a.payment_status !== 'cortesia' && Number(a.price||0) > payments.filter(p=>p.appointment_id===a.id).reduce((t,p)=>t+Number(p.amount||0),0) && !(a.payment_status==='pago' && !payments.some(p=>p.appointment_id===a.id)))
  const nextAppointment = todayAppointments.find(a => a.status !== 'cancelada' && String(a.appointment_time).slice(0,5) >= new Date().toTimeString().slice(0,5))

  return <div className="phone-app">
    <header className="topbar"><div className="reabilitar-header-brand"><img src="/logo-reabilitar.png" alt="Logo Reabilitar Psicologia"/><h1>LUZIANE MUZZI LAGE<br/>REABILITAR PSICOLOGIA</h1></div><button className="icon-only" onClick={onLogout}><LogOut size={24}/></button></header>
    {hasSupabase && <div className="connection-pill online">Supabase conectado</div>}
    {loading && <div className="loading">Carregando...</div>}
    {!loading && tab === 'hoje' && <TodayScreen selectedDate={isoToday} appointments={todayAppointments} pendingPayments={pendingPayments} nextAppointment={nextAppointment} onNew={()=>{setSelectedDate(isoToday); setModal({type:'appointment'})}} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'agenda' && <CalendarScreen calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} dayAppointments={dayAppointments} onNew={()=>setModal({type:'appointment'})} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'pacientes' && <PatientsScreen patients={patients} appointments={appointments} onNew={()=>setModal({type:'patient'})} onEdit={(p)=>setModal({type:'patient', item:p})} onDelete={deletePatient} />}
    {!loading && tab === 'financeiro' && <FinanceScreen appointments={appointments} patients={patients} payments={payments} packages={packages} onNewPackage={()=>setModal({type:'package'})} onEditPackage={(pkg)=>setModal({type:'package',item:pkg})} onDeletePackage={deletePackage} onEdit={(a)=>setModal({type:'appointment', item:a})} onNewPayment={(a,pkg)=>setModal({type:'payment',item:{appointment_id:a?.id||'',package_id:pkg?.id||'',payment_date:isoToday,amount:'',payment_method:'pix',notes:''}})} onEditPayment={(p)=>setModal({type:'payment',item:p})} onDeletePayment={deletePayment} />}
    {!loading && tab === 'ajustes' && <SettingsScreen settings={settings} onSave={saveSettings} patients={patients} appointments={appointments} pendingPayments={pendingPayments} />}
    <nav className="bottom-nav"><button className={tab==='hoje'?'active':''} onClick={()=>setTab('hoje')}><Sun/><span>Hoje</span></button><button className={tab==='agenda'?'active':''} onClick={()=>setTab('agenda')}><CalendarDays/><span>Agenda</span></button><button className={tab==='pacientes'?'active':''} onClick={()=>setTab('pacientes')}><UsersRound/><span>Pacientes</span></button><button className={tab==='financeiro'?'active':''} onClick={()=>setTab('financeiro')}><BarChart3/><span>Financeiro</span></button><button className={tab==='ajustes'?'active':''} onClick={()=>setTab('ajustes')}><Settings/><span>Ajustes</span></button></nav>
    {modal?.type === 'payment' && <PaymentModal item={modal.item} appointments={appointments} packages={packages} patients={patients} payments={payments} onClose={()=>setModal(null)} onSave={savePayment} />}
    {modal?.type === 'package' && <PackageModal item={modal.item} patients={patients} onClose={()=>setModal(null)} onSave={savePackage} />}
    {modal?.type === 'patient' && <PatientModal item={modal.item} onClose={()=>setModal(null)} onSave={savePatient} />}
    {modal?.type === 'appointment' && <AppointmentModal item={modal.item} patients={patients} selectedDate={selectedDate} settings={settings} onClose={()=>setModal(null)} onSave={saveAppointment} onUpdateGroup={updateRecurringGroup} />}
  </div>
}

function PageTitle({kicker,title,action}) { return <section className="page-title"><span>{kicker}</span><div><h2>{title}</h2>{action}</div></section> }
function StatsRow({appointments, pendingPayments, nextAppointment}) { return <section className="stats-row"><div><b>{appointments.length}</b><span>consultas hoje</span></div><div><b>{pendingPayments.length}</b><span>pendências</span></div><div><b>{nextAppointment ? String(nextAppointment.appointment_time).slice(0,5) : '--:--'}</b><span>próxima</span></div></section> }
function TodayScreen({ selectedDate, appointments, pendingPayments, nextAppointment, onNew, onEdit, onDelete }) {
  return <main className="screen today-screen"><PageTitle kicker="HOJE" title={niceDate(selectedDate)} />
    <section className="today-hero">
      <div><span>Resumo do dia</span><h3>{appointments.length ? `${appointments.length} consulta${appointments.length > 1 ? 's' : ''} hoje` : 'Agenda livre hoje'}</h3><p>{nextAppointment ? `Próxima: ${nextAppointment.patient_name} às ${String(nextAppointment.appointment_time).slice(0,5)}` : 'Nenhuma consulta marcada para hoje.'}</p></div>
      <button className="primary" onClick={onNew}><Plus/> Nova Consulta</button>
    </section>
    <StatsRow appointments={appointments} pendingPayments={pendingPayments} nextAppointment={nextAppointment}/>
    {nextAppointment && <div className="soft-alert"><AlertTriangle size={18}/> Próxima consulta: <b>{nextAppointment.patient_name}</b> às <b>{String(nextAppointment.appointment_time).slice(0,5)}</b></div>}
    <div className="section-label">Consultas de hoje</div>
    <div className="cards-list today-list">{appointments.length ? appointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a)} />) : <Empty text="Nenhuma consulta hoje." />}</div>
    {pendingPayments.length > 0 && <section className="settings-card pending-card"><h2><WalletCards size={18}/> Pagamentos pendentes</h2>{pendingPayments.slice(0,5).map(a=><p key={a.id} className="pending-line">{formatDateBR(a.appointment_date)} • {a.patient_name} • R$ {Number(a.price||0).toFixed(2)}</p>)}</section>}
  </main>
}
function AppointmentCard({a,onEdit,onDelete}) {
  const w = whatsappUrl(a.patient_phone || a.patient_phone_snapshot, a)
  return <article className="appointment-card"><div className="card-actions"><button onClick={onEdit}><Edit3/></button><button onClick={onDelete}><Trash2/></button></div><div className="time-row"><strong>{String(a.appointment_time||'').slice(0,5)}</strong><span><Clock3 size={18}/> {a.duration_minutes} min</span></div><h3>{a.patient_name || a.patient_name_snapshot}</h3><div className="meta"><span><Phone size={18}/> {a.patient_phone || a.patient_phone_snapshot || 'Sem telefone'}</span><span>{a.service_type}</span></div><div className="badges"><Badge type={a.status}>{labelStatus(a.status)}</Badge><Badge type={a.payment_status}>{labelPay(a.payment_status)}</Badge>{a.recurrence_group_id && <Badge type="recorrente"><Repeat2 size={13}/> {labelRepeat(a.recurrence_frequency)}</Badge>}<span className="price">R$ {Number(a.price||0).toFixed(2)}</span></div>{a.notes && <p>{a.notes}</p>}<div className="quick-row">{w && <a className="whatsapp-btn" href={w} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>}</div></article>
}
function CalendarScreen({ calendarMonth, setCalendarMonth, selectedDate, setSelectedDate, appointments, dayAppointments, onNew, onEdit, onDelete }) {
  return <main className="screen"><div className="month-head"><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))}><ChevronLeft/></button><h2>{monthTitle(calendarMonth)}</h2><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))}><ChevronRight/></button></div><CalendarGrid month={calendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} /><div className="day-head"><h2>{niceDate(selectedDate)}</h2><button className="primary small" onClick={onNew}><Plus/> Nova Consulta</button></div><div className="cards-list agenda-day">{dayAppointments.length ? dayAppointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a)} />) : <Empty text="Nenhuma consulta neste dia." />}</div></main>
}
function CalendarGrid({month, selectedDate, setSelectedDate, appointments}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1); const start = new Date(first); start.setDate(start.getDate() - start.getDay())
  const days = Array.from({length: 42}, (_,i)=> { const d=new Date(start); d.setDate(start.getDate()+i); return d })
  const week = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']
  return <div className="calendar-card">{week.map(w=><b key={w}>{w}</b>)}{days.map(d => { const iso = toISODate(d), inMonth = d.getMonth() === month.getMonth(), count = appointments.filter(a=>a.appointment_date===iso).length; return <button key={iso} className={`${iso===selectedDate?'selected':''} ${!inMonth?'muted':''}`} onClick={()=>setSelectedDate(iso)}><span>{d.getDate()}</span>{count>0 && <i>{Array.from({length: Math.min(count,3)}).map((_,i)=><em key={i}/>)}</i>}</button> })}</div>
}
function PatientsScreen({patients, appointments, onNew, onEdit, onDelete}) {
  const [q,setQ]=useState('')
  const filtered = patients.filter(p => `${p.full_name} ${p.phone} ${p.whatsapp}`.toLowerCase().includes(q.toLowerCase()))
  return <main className="screen"><PageTitle kicker="PACIENTES" title="Meus Pacientes" /><div className="search-row"><label><Search/><input placeholder="Buscar por nome ou telefone..." value={q} onChange={e=>setQ(e.target.value)} /></label><button className="square" onClick={onNew}><Plus/></button></div><div className="cards-list">{filtered.map(p => <PatientCard key={p.id} p={p} appointments={appointments.filter(a=>a.patient_id===p.id)} onEdit={()=>onEdit(p)} onDelete={()=>onDelete(p.id)} />)}</div></main>
}
function PatientCard({p, appointments, onEdit, onDelete}) {
  const next = appointments.filter(a=>a.appointment_date >= isoToday && a.status !== 'cancelada').sort((a,b)=>`${a.appointment_date} ${a.appointment_time||''}`.localeCompare(`${b.appointment_date} ${b.appointment_time||''}`))[0]
  const done = appointments.filter(a=>a.status==='realizada').length
  const missed = appointments.filter(a=>a.status==='faltou').length
  const pending = appointments.filter(a=>a.payment_status==='pendente' && a.status!=='cancelada').length
  // Na aba Pacientes, usa a próxima consulta para montar a mensagem automática com data e horário.
  const w = whatsappUrl(p.phone || p.whatsapp, next || null, p.full_name)
  return <article className="patient-card"><div className="patient-main"><h3>{p.full_name}</h3><Badge type={p.status}>{labelPatient(p.status)}</Badge></div><div className="patient-actions"><button onClick={onEdit}><Edit3/></button><button onClick={onDelete}><Trash2/></button></div><span className="phone-line"><Phone size={18}/> {p.phone || p.whatsapp || 'Sem telefone'}</span>{p.guardian_name && <p>Resp: {p.guardian_name}</p>}{p.notes && <em>{p.notes}</em>}<div className="history-grid"><span><b>{appointments.length}</b> total</span><span><b>{done}</b> realizadas</span><span><b>{missed}</b> faltas</span><span><b>{pending}</b> pendências</span></div>{next && <small>Próxima: {formatDateBR(next.appointment_date)} às {String(next.appointment_time).slice(0,5)}</small>}<div className="quick-row">{w && <a className="whatsapp-btn" href={w} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>}</div></article>
}


function FinanceScreen({appointments, patients, payments, packages, onEdit, onNewPayment, onEditPayment, onDeletePayment, onNewPackage, onEditPackage, onDeletePackage}) {
  const [period,setPeriod]=useState('mes')
  const [reference,setReference]=useState(isoToday)
  const [customStart,setCustomStart]=useState(isoToday)
  const [customEnd,setCustomEnd]=useState(isoToday)
  const [patientId,setPatientId]=useState('')
  const [search,setSearch]=useState('')
  const weekMonday=(iso)=>{const d=dateFromISO(iso);d.setDate(d.getDate() - ((d.getDay()+6)%7));return toISODate(d)}
  const inPeriod=(date)=>{
    if(!date)return false
    if(period==='total')return true
    if(period==='dia')return date===reference
    if(period==='semana'){const a=weekMonday(reference);const b=dateFromISO(a);b.setDate(b.getDate()+6);return date>=a&&date<=toISODate(b)}
    if(period==='mes')return date.slice(0,7)===reference.slice(0,7)
    if(period==='ano')return date.slice(0,4)===reference.slice(0,4)
    return date>=customStart&&date<=customEnd
  }
  const activeAppointments=appointments.filter(a=>a.status!=='cancelada'&&a.payment_status!=='cortesia')
  const amountPaid=(type,id)=>payments.filter(p=>type==='package'?p.package_id===id:p.appointment_id===id).reduce((sum,p)=>sum+Number(p.amount||0),0)
  const entries=[
    ...activeAppointments.map(a=>({id:'a'+a.id,kind:'appointment',source:a,patientId:a.patient_id,patientName:a.patient_name||a.patient_name_snapshot||'',description:a.service_type||'Sessão',value:Number(a.price||0),dueDate:a.appointment_date,paid:amountPaid('appointment',a.id)})),
    ...packages.map(pkg=>({id:'p'+pkg.id,kind:'package',source:pkg,patientId:pkg.patient_id,patientName:patients.find(p=>p.id===pkg.patient_id)?.full_name||'',description:pkg.description||'Avaliação / pacote',value:Number(pkg.total_amount||0),dueDate:pkg.due_date||'',paid:amountPaid('package',pkg.id)}))
  ].map(e=>({...e,remaining:Math.max(0,e.value-e.paid)}))
  const patientEntries=entries.filter(e=>!patientId||e.patientId===patientId)
  const correspondingPayments=payments.filter(p=> {
    const e=entries.find(x=>p.package_id ? x.kind==='package'&&x.source.id===p.package_id:x.kind==='appointment'&&x.source.id===p.appointment_id)
    return e&&(!patientId||e.patientId===patientId)
  })
  const received=correspondingPayments.filter(p=>inPeriod(p.payment_date)).reduce((sum,p)=>sum+Number(p.amount||0),0)
  const referenceDate=period==='total'?isoToday:period==='custom'?customEnd:reference
  const overdue=patientEntries.filter(e=>e.dueDate&&e.dueDate<referenceDate).reduce((sum,e)=>sum+e.remaining,0)
  const upcoming=patientEntries.filter(e=>!e.dueDate||e.dueDate>=referenceDate).reduce((sum,e)=>sum+e.remaining,0)
  const paidOff=patientEntries.filter(e=>e.value>0&&e.remaining<0.005&&inPeriod(e.dueDate)).length
  const patientRows=patients.filter(p=>!patientId||p.id===patientId).filter(p=>p.full_name.toLowerCase().includes(search.toLowerCase())).map(p=>{
    const items=entries.filter(e=>e.patientId===p.id)
    return {person:p,items,value:items.reduce((t,e)=>t+e.value,0),paid:items.reduce((t,e)=>t+Math.min(e.paid,e.value),0),remaining:items.reduce((t,e)=>t+e.remaining,0)}
  })
  const selectedPatient=patients.find(p=>p.id===patientId)
  function exportCsv(){
    const rows=[['Paciente','Tipo','Serviço','Valor contratado','Recebido','Restante','Vencimento'],...patientEntries.map(e=>[e.patientName,e.kind==='package'?'Pacote':'Sessão',e.description,e.value.toFixed(2),e.paid.toFixed(2),e.remaining.toFixed(2),e.dueDate])]
    const csv='\uFEFF'+rows.map(row=>row.map(cell=>'"'+String(cell??'').replaceAll('"','""')+'"').join(';')).join('\r\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='folhas-financeiras-reabilitar.csv';a.click();URL.revokeObjectURL(url)
  }
  return <main className="screen finance-screen">
    <PageTitle kicker="FINANCEIRO" title="Controle Financeiro"/>
    <section className="finance-filters">
      <button className="primary small" onClick={onNewPackage}><Plus/> Nova avaliação / pacote</button>
      <button className="primary small" onClick={()=>onNewPayment(null,null)}><Plus/> Registrar pagamento</button>
      <button className="primary small" onClick={exportCsv}><Download/> Exportar CSV</button>
    </section>
    <section className="settings-card reabilitar-financial-panel">
      <div className="financial-header"><div><h2>Visão geral do financeiro</h2><p>Recebimentos pelo dia do pagamento. Pendências calculadas pelos vencimentos.</p></div></div>
      <div className="financial-periods">
        {[['dia','Dia'],['semana','Semana'],['mes','Mês'],['ano','Ano'],['total','Total'],['custom','Personalizado']].map(([key,label])=><button key={key} type="button" className={period===key?'active':''} onClick={()=>setPeriod(key)}>{label}</button>)}
      </div>
      <div className="financial-filter-row">
        {period!=='total'&&period!=='custom'&&<label>Data de referência<input type="date" value={reference} onChange={e=>setReference(e.target.value)}/></label>}
        {period==='custom'&&<><label>De<input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label><label>Até<input type="date" min={customStart} value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></label></>}
        <label>Paciente<select value={patientId} onChange={e=>setPatientId(e.target.value)}><option value="">Todos os pacientes</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
      </div>
      <section className="finance-grid">
        <FinanceCard icon={<CircleDollarSign/>} label="Recebido no período" value={money(received)} hint="Pagamentos efetivamente registrados"/>
        <FinanceCard icon={<Clock3/>} label="Em atraso" value={money(overdue)} hint="Saldos com vencimento anterior à referência"/>
        <FinanceCard icon={<WalletCards/>} label="A receber" value={money(upcoming)} hint="Saldos ainda não vencidos"/>
        <FinanceCard icon={<CheckCircle2/>} label="Cobranças quitadas" value={String(paidOff)} hint="Cobranças com saldo integralmente pago"/>
      </section>
    </section>
    <section className="settings-card reabilitar-financial-panel">
      <div className="financial-header"><div><h2>Folha financeira por paciente</h2><p>Valor total contratado, pagamentos registrados e saldo restante por pessoa.</p></div></div>
      <label className="financial-search">Buscar paciente<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pelo nome"/></label>
      {patientRows.length?patientRows.map(({person,items,value,paid,remaining})=><article key={person.id} className="patient-ledger">
        <div className="patient-ledger-title"><h3>{person.full_name}</h3><span>{items.length} cobrança{items.length===1?'':'s'}</span></div>
        <div className="patient-ledger-values">
          <div><small>VALOR TOTAL</small><strong>{money(value)}</strong></div>
          <div><small>RECEBIDO</small><strong className="positive-value">{money(paid)}</strong></div>
          <div><small>RESTANTE</small><strong className="negative-value">{money(remaining)}</strong></div>
        </div>
        <div className="ledger-progress"><div style={{width:`${value>0?Math.max(0,Math.min(100,paid/value*100)):0}%`}}/></div>
        <div className="ledger-lines">{items.map(e=><div className="ledger-line" key={e.id}>
          <div><b>{e.description}</b><small>{e.kind==='package'?'Avaliação / pacote':'Sessão individual'}{e.dueDate?' · '+formatDateBR(e.dueDate):''}</small></div>
          <span>{money(e.value)}</span><span className="positive-value">{money(e.paid)}</span><strong className={e.remaining>0?'negative-value':'positive-value'}>{money(e.remaining)}</strong>
          <div className="payment-history-actions">
            <button title="Registrar recebimento" onClick={()=>onNewPayment(e.kind==='appointment'?e.source:null,e.kind==='package'?e.source:null)}><Plus size={16}/></button>
            {e.kind==='package'&&<button title="Editar cobrança" onClick={()=>onEditPackage(e.source)}><Edit3 size={16}/></button>}
            {e.kind==='appointment'&&<button title="Editar consulta" onClick={()=>onEdit(e.source)}><Edit3 size={16}/></button>}
          </div>
        </div>)}</div>
        {items.length===0&&<p className="ledger-empty">Nenhuma cobrança cadastrada para este paciente.</p>}
        {correspondingPayments.filter(p=>items.some(e=>e.kind==='package'?p.package_id===e.source.id:p.appointment_id===e.source.id)).length>0&&<div className="ledger-payment-history">
          <h4>Pagamentos registrados</h4>
          {correspondingPayments.filter(p=>items.some(e=>e.kind==='package'?p.package_id===e.source.id:p.appointment_id===e.source.id)).sort((a,b)=>b.payment_date.localeCompare(a.payment_date)).map(pay=>{
            const ap=appointments.find(a=>a.id===pay.appointment_id);const pkg=packages.find(x=>x.id===pay.package_id);
            return <div className="payment-history-row" key={pay.id}><div><b>{formatDateBR(pay.payment_date)} · {money(pay.amount)}</b><span>{pay.payment_method} · {pkg?.description||ap?.service_type||'Sessão'}</span></div><div className="payment-history-actions">
              <button title="Imprimir comprovante" onClick={()=>printReceipt(pay,ap||(pkg?{patient_name:person.full_name,service_type:pkg.description}:null))}><Printer size={17}/></button>
              <button title="Editar recebimento" onClick={()=>onEditPayment(pay)}><Edit3 size={17}/></button>
              <button title="Excluir recebimento" onClick={()=>onDeletePayment(pay)}><Trash2 size={17}/></button>
            </div></div>
          })}
        </div>}
      </article>):<Empty text="Nenhum paciente encontrado. Cadastre um paciente para iniciar a folha financeira."/>}
    </section>
    <section className="settings-card finance-list"><h2>Avaliações e pacotes</h2>{packages.length?packages.map(pkg=>{const person=patients.find(x=>x.id===pkg.patient_id);const received=amountPaid('package',pkg.id);const rest=Math.max(0,Number(pkg.total_amount||0)-received);return <div className="package-record" key={pkg.id}><div className="package-record-details"><b>{person?.full_name||'Paciente'}</b><span>{pkg.description} · {money(pkg.total_amount)}</span><span>Recebido: {money(received)} · <b className="negative-value">Restante: {money(rest)}</b></span></div><div className="payment-history-actions"><button title="Registrar pagamento" onClick={()=>onNewPayment(null,pkg)}><Plus size={17}/></button><button title="Editar" onClick={()=>onEditPackage(pkg)}><Edit3 size={17}/></button><button title="Excluir" onClick={()=>onDeletePackage(pkg)}><Trash2 size={17}/></button></div></div>}) : <Empty text="Nenhuma avaliação ou pacote cadastrado."/>}</section>
  </main>
}
function FinanceCard({icon,label,value,hint}) { return <article className="finance-card"><div>{icon}</div><span>{label}</span><b>{value}</b><p>{hint}</p></article> }

function SettingsScreen({settings, onSave, patients, appointments, pendingPayments}) {
  const [passwordOpen,setPasswordOpen]=useState(false)
  const [form,setForm] = useState(settings); useEffect(()=>setForm(settings),[settings]); function update(k,v){ setForm({...form,[k]:v}) }
  function exportData(){ const blob = new Blob([JSON.stringify({patients,appointments,settings}, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-agenda-luziane.json'; a.click() }
  return <main className="screen"><PageTitle kicker="CONFIGURAÇÕES" title="Ajustes" /><section className="settings-card"><h2>Resumo rápido</h2><div className="history-grid"><span><b>{patients.length}</b> pacientes</span><span><b>{appointments.length}</b> consultas</span><span><b>{pendingPayments.length}</b> pendentes</span><span><b>{appointments.filter(a=>a.recurrence_group_id).length}</b> recorrentes</span></div></section><section className="settings-card"><h2>Dados da Clínica</h2><label>Nome da clínica / profissional<input value={form.clinic_name||''} onChange={e=>update('clinic_name',e.target.value)} /></label><div className="two"><label>Horário de início<select value={form.start_time} onChange={e=>update('start_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label><label>Horário de término<select value={form.end_time} onChange={e=>update('end_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label></div><div className="two"><label>Duração padrão (min)<input type="number" min="0" step="1" placeholder="Ex: 50" value={form.default_duration ?? ''} onChange={e=>update('default_duration',e.target.value)} /></label><label>Valor padrão (R$)<input type="number" min="0" step="0.01" placeholder="Ex: 500" value={form.default_price ?? ''} onChange={e=>update('default_price',e.target.value)} /></label></div><button className="primary wide" onClick={()=>onSave(form)}><Save/> Salvar Configurações</button></section><section className="settings-card"><h2>Segurança da conta</h2><p>Atualize sua senha de acesso à agenda.</p><button className="primary" onClick={()=>setPasswordOpen(true)}>Alterar senha</button></section>{passwordOpen&&<ChangePasswordModal onClose={()=>setPasswordOpen(false)}/>}<section className="settings-card tools"><h2>Ferramentas</h2><button onClick={exportData}><Download/> Exportar backup</button><button onClick={()=>window.print()}><Printer/> Imprimir agenda</button></section></main>
}

function ChangePasswordModal({onClose}){
 const [currentPassword,setCurrentPassword]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [message,setMessage]=useState('')
 const [saving,setSaving]=useState(false)
 async function submit(e){
   e.preventDefault();setMessage('')
   if(newPassword.length<8){setMessage('A nova senha precisa ter pelo menos 8 caracteres.');return}
   if(newPassword!==confirmPassword){setMessage('As senhas informadas não coincidem.');return}
   setSaving(true)
   try{
    const res=await fetch('/api/change-password',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword,newPassword,confirmPassword})})
    const result=await res.json()
    if(!res.ok){setMessage(result.error||'Não foi possível alterar a senha.');return}
    onClose();await alert('Senha alterada com sucesso.')
   }catch(e){setMessage('Não foi possível conectar ao servidor.')}
   finally{setSaving(false)}
 }
 return <Modal title="Alterar senha de acesso" onClose={onClose}>
   <form className="luz-password-form" onSubmit={submit}>
     <p>Confirme sua senha atual para proteger o acesso à agenda.</p>
     <label>Senha atual<input type="password" required autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
     <label>Nova senha<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
     <label>Confirmar nova senha<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
     {message&&<p role="alert" className="luz-password-error">{message}</p>}
     <div className="luz-password-actions"><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving?'Salvando...':'Confirmar alteração'}</button></div>
   </form>
 </Modal>
}

function PatientModal({item,onClose,onSave}) {
  const [f,setF]=useState(item || {full_name:'',phone:'',birth_date:'',cpf:'',mother_name:'',father_name:'',mother_phone:'',father_phone:'',guardian_name:'',education:'',school_name:'',school_type:'',school_grade:'',referred_by:'',email:'',notes:'',status:'ativo'})
  const u=(k,v)=>setF(old=>({...old,[k]:v}))
  const age=f.birth_date ? (()=> { const b=dateFromISO(f.birth_date),t=new Date();return t.getFullYear()-b.getFullYear()-(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate())?1:0) })() : ''
  return <Modal title={item?'Editar Paciente':'Novo Paciente'} onClose={onClose}>
    <h3 className="form-section">Dados pessoais</h3>
    <label>Nome completo<input value={f.full_name||''} onChange={e=>u('full_name',e.target.value)} /></label>
    <div className="two"><label>Data de nascimento<input type="date" value={f.birth_date||''} onChange={e=>u('birth_date',e.target.value)} /></label><label>Idade<input readOnly value={age === ''?'Calculada automaticamente':`${age} anos`} /></label></div>
    <label>CPF do paciente<input inputMode="numeric" maxLength={14} placeholder="000.000.000-00" value={f.cpf||''} onChange={e=>u('cpf',e.target.value)} /></label>
    <label>Telefone/WhatsApp<input value={f.phone||''} onChange={e=>u('phone',e.target.value)} /></label>
    <label>E-mail<input value={f.email||''} onChange={e=>u('email',e.target.value)} /></label>
    <h3 className="form-section">Filiação e responsáveis</h3>
    <div className="two"><label>Nome da mãe<input value={f.mother_name||''} onChange={e=>u('mother_name',e.target.value)} /></label><label>Contato da mãe<input value={f.mother_phone||''} onChange={e=>u('mother_phone',e.target.value)} /></label></div>
    <div className="two"><label>Nome do pai<input value={f.father_name||''} onChange={e=>u('father_name',e.target.value)} /></label><label>Contato do pai<input value={f.father_phone||''} onChange={e=>u('father_phone',e.target.value)} /></label></div>
    <label>Responsável legal / contato preferencial<input value={f.guardian_name||''} onChange={e=>u('guardian_name',e.target.value)} /></label>
    <h3 className="form-section">Escolaridade</h3>
    <label>Escolaridade<input value={f.education||''} onChange={e=>u('education',e.target.value)} /></label>
    <label>Nome da escola<input value={f.school_name||''} onChange={e=>u('school_name',e.target.value)} /></label>
    <div className="two"><label>Rede de ensino<select value={f.school_type||''} onChange={e=>u('school_type',e.target.value)}><option value="">Não informado</option><option value="publica">Pública</option><option value="particular">Particular / privada</option><option value="nao_aplica">Não se aplica</option></select></label><label>Série / ano<input value={f.school_grade||''} onChange={e=>u('school_grade',e.target.value)} /></label></div>
    <h3 className="form-section">Encaminhamento e observações</h3>
    <label>Encaminhado por alguém? (nome/profissional)<input value={f.referred_by||''} onChange={e=>u('referred_by',e.target.value)} /></label>
    <label>Status<select value={f.status||'ativo'} onChange={e=>u('status',e.target.value)}><option value="ativo">Ativo</option><option value="em_avaliacao">Em avaliação</option><option value="finalizado">Finalizado</option><option value="inativo">Inativo</option></select></label>
    <label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label>
    <button className="primary wide" onClick={()=>onSave({...f,age:String(age)})}><Save/> Salvar Paciente</button>
  </Modal>
}
function PackageModal({item,patients,onClose,onSave}){
 const [f,setF]=useState(item||{patient_id:'',description:'Avaliação neuropsicológica',total_amount:'',due_date:'',notes:''})
 const u=(k,v)=>setF(o=>({...o,[k]:v}))
 return <Modal title={f.id?'Editar avaliação / pacote':'Nova avaliação / pacote'} onClose={onClose}>
 <label>Paciente<select value={f.patient_id||''} onChange={e=>u('patient_id',e.target.value)}><option value="">Selecionar paciente</option>{patients.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
 <label>Descrição<input value={f.description||''} onChange={e=>u('description',e.target.value)} placeholder="Ex.: Avaliação neuropsicológica completa" /></label>
 <div className="two"><label>Valor total combinado<input type="number" min="0.01" step="0.01" value={f.total_amount??''} onChange={e=>u('total_amount',e.target.value)} /></label><label>Vencimento previsto (opcional)<input type="date" value={f.due_date||''} onChange={e=>u('due_date',e.target.value)} /></label></div>
 <label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)}/></label>
 <button className="primary wide" onClick={()=>onSave(f)}><Save/> Salvar cobrança</button>
 </Modal>
}
function PaymentModal({item,appointments,packages,patients,payments,onClose,onSave}) {
 const [f,setF]=useState(item||{appointment_id:'',payment_date:isoToday,amount:'',payment_method:'pix',notes:''});const u=(k,v)=>setF(o=>({...o,[k]:v}))
 const a=appointments.find(a=>a.id===f.appointment_id)
 const pkg=packages.find(p=>p.id===f.package_id)
 const received=payments.filter(p=>(pkg?p.package_id===pkg.id:p.appointment_id===f.appointment_id)&&p.id!==f.id).reduce((t,p)=>t+Number(p.amount||0),0)
 return <Modal title={f.id?'Editar recebimento':'Registrar recebimento'} onClose={onClose}>
 <label>Destino do recebimento<select value={f._type|| (f.package_id?'pacote':'sessao')} onChange={e=>setF(o=>({...o,appointment_id:'',package_id:'',_type:e.target.value}))}><option value="sessao">Sessão individual</option><option value="pacote">Avaliação ou pacote</option></select></label>
 {(f._type==='pacote'||Boolean(f.package_id)) ? <label>Avaliação / pacote<select value={f.package_id||''} onChange={e=>setF(o=>({...o,package_id:e.target.value,appointment_id:'',_type:'pacote'}))}><option value="">Selecione o pacote</option>{packages.map(p=><option key={p.id} value={p.id}>{patients.find(x=>x.id===p.patient_id)?.full_name} — {p.description} — {money(p.total_amount)}</option>)}</select></label> : <label>Consulta<select value={f.appointment_id||''} onChange={e=>setF(o=>({...o,appointment_id:e.target.value,package_id:'',_type:'sessao'}))}><option value="">Selecione a consulta</option>{appointments.filter(a=>a.status!=='cancelada').map(a=><option key={a.id} value={a.id}>{a.patient_name} — {formatDateBR(a.appointment_date)} — {money(a.price)}</option>)}</select></label>}
 {pkg&&<p className="form-hint">Valor combinado: {money(pkg.total_amount)} • Já recebido: {money(received)} • Restante: {money(Math.max(0,Number(pkg.total_amount||0)-received))}</p>}
 {a&&<p className="form-hint">Valor total: {money(a.price)} • Já recebido: {money(received)} • Restante: {money(Math.max(0,Number(a.price||0)-received))}</p>}
 <div className="two"><label>Data do pagamento<input type="date" value={f.payment_date||''} onChange={e=>u('payment_date',e.target.value)}/></label><label>Valor recebido<input type="number" min="0.01" step="0.01" value={f.amount??''} onChange={e=>u('amount',e.target.value)}/></label></div>
 <label>Forma de pagamento<select value={f.payment_method||'pix'} onChange={e=>u('payment_method',e.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label>
 <label>Observações / referência para comprovante<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)}/></label>
 <button className="primary wide" onClick={()=>onSave(f)}><Save/> Salvar recebimento</button></Modal>
}
function printReceipt(payment,appointment,settingsName='LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA'){
 const safe=t=>String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 const w=window.open('','_blank');if(!w){alert('Permita janelas pop-up para imprimir o comprovante.');return}
 w.document.write(`<html><head><title>Comprovante de recebimento</title><style>body{font-family:Arial,sans-serif;color:#302923;max-width:680px;margin:55px auto;padding:20px}h1{font-size:22px;letter-spacing:2px;border-bottom:1px solid #cdbfb5;padding-bottom:22px}h2{font-size:18px;margin:40px 0 24px}p{line-height:2}footer{margin-top:70px;border-top:1px solid #aaa;padding-top:12px;text-align:center}small{color:#666}</style></head><body><h1>${safe(settingsName)}</h1><h2>COMPROVANTE DE RECEBIMENTO</h2><p><b>Paciente:</b> ${safe(appointment?.patient_name)}</p><p><b>Atendimento:</b> ${safe(appointment?.service_type)} — ${appointment?.appointment_date?formatDateBR(appointment.appointment_date):''}</p><p><b>Data do pagamento:</b> ${formatDateBR(payment.payment_date)}</p><p><b>Valor recebido:</b> ${money(payment.amount)}</p><p><b>Forma de pagamento:</b> ${safe(payment.payment_method)}</p><p><b>Observações:</b> ${safe(payment.notes||'—')}</p><footer>${safe(settingsName)}<br/><small>Comprovante administrativo de recebimento. Não substitui documento fiscal.</small></footer><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()
}
function AppointmentModal({item,patients,selectedDate,settings,onClose,onSave,onUpdateGroup}) {
  const [f,setF]=useState(item || {patient_id: patients[0]?.id || '', patient_name:'', patient_phone:'', appointment_date:selectedDate, appointment_time:'09:00', duration_minutes:settings.default_duration ?? 50, service_type:'Avaliação', status:'agendada', payment_status:'pendente', price:settings.default_price ?? '', room:'Sala 1', notes:''})
  const [repeat,setRepeat]=useState('none'); const [count,setCount]=useState(4); const [scope,setScope]=useState('one')
  const u=(k,v)=>setF({...f,[k]:v})
  const selectedPatient = patients.find(p=>p.id===f.patient_id)
  function save(){ if (item?.recurrence_group_id && scope !== 'one') { onUpdateGroup(item, {...f, patient_name:selectedPatient?.full_name || f.patient_name, patient_phone:selectedPatient?.phone || f.patient_phone}, scope); return } onSave(f, { repeat, count }) }
  return <Modal title={item?'Editar Consulta':'Nova Consulta'} onClose={onClose}><label>Paciente<select value={f.patient_id||''} onChange={e=>u('patient_id',e.target.value)}><option value="">Selecionar paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><p className="form-hint">Cadastre o paciente na aba Pacientes antes de marcar a consulta.</p><div className="two"><label>Data<input type="date" value={f.appointment_date} onChange={e=>u('appointment_date',e.target.value)} /></label><label>Horário<input type="time" value={String(f.appointment_time||'').slice(0,5)} onChange={e=>u('appointment_time',e.target.value)} /></label></div><div className="two"><label>Duração<input type="number" min="0" step="1" placeholder="Ex: 50" value={f.duration_minutes ?? ''} onChange={e=>u('duration_minutes',e.target.value)} /></label><label>Valor<input type="number" min="0" step="0.01" placeholder="Ex: 500" value={f.price ?? ''} onChange={e=>u('price',e.target.value)} /></label></div>{!item && <section className="recurrence-box"><h3><Repeat2 size={16}/> Repetir consulta</h3><label>Recorrência<select value={repeat} onChange={e=>setRepeat(e.target.value)}><option value="none">Não repetir</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label>{repeat !== 'none' && <label>Quantidade de sessões<input type="number" min="1" step="1" value={count} onChange={e=>setCount(e.target.value)} /></label>}</section>}{item?.recurrence_group_id && <section className="recurrence-box"><h3><Repeat2 size={16}/> Consulta recorrente</h3><label>Aplicar alteração em:<select value={scope} onChange={e=>setScope(e.target.value)}><option value="one">Apenas esta consulta</option><option value="future">Esta e próximas</option><option value="all">Toda a sequência</option></select></label></section>}<label>Tipo<input value={f.service_type||''} onChange={e=>u('service_type',e.target.value)} /></label><div className="two"><label>Status<select value={f.status} onChange={e=>u('status',e.target.value)}><option value="agendada">Agendada</option><option value="aguardando_confirmacao">Aguardando confirmação</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="remarcada">Remarcada</option><option value="faltou">Faltou</option><option value="cancelada">Cancelada</option></select></label><label>Pagamento<select value={f.payment_status} onChange={e=>u('payment_status',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cortesia">Cortesia</option></select></label></div><label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label><button className="primary wide" onClick={save}><Save/> Salvar Consulta</button></Modal>
}
function Modal({title,children,onClose}) { return <div className="overlay"><section className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</section></div> }
function Badge({type,children}) { return <span className={`badge ${type}`}>{children}</span> }
function Empty({text}) { return <div className="empty">{text}</div> }
function labelStatus(s){return {agendada:'Agendada',aguardando_confirmacao:'Aguardando confirmação',confirmada:'Confirmada',realizada:'Realizada',remarcada:'Remarcada',faltou:'Faltou',cancelada:'Cancelada'}[s]||s}
function labelPay(s){return {pago:'Pago',pendente:'Pendente',cortesia:'Cortesia'}[s]||s}
function labelPatient(s){return {ativo:'Ativo',em_avaliacao:'Em avaliação',finalizado:'Finalizado',inativo:'Inativo'}[s]||s}
function labelRepeat(s){return {weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal'}[s]||'Recorrente'}
function timeOpts(){ const arr=[]; for(let h=6;h<=22;h++) arr.push(`${String(h).padStart(2,'0')}:00`); return arr }

createRoot(document.getElementById('root')).render(<App />)
