-- ============================================================
-- MIGRAÇÃO SEGURA - LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA
-- Use este arquivo quando você JÁ TEM dados no Supabase.
-- Ele NÃO apaga tabelas e NÃO remove pacientes/consultas.
-- ============================================================

create extension if not exists pgcrypto;

-- Garante UUID automático nas tabelas existentes.
alter table if exists public.luziane_reabilitar_2026_patients
  alter column id set default gen_random_uuid();

alter table if exists public.luziane_reabilitar_2026_appointments
  alter column id set default gen_random_uuid();

-- Colunas de pacientes usadas pelo app.
alter table if exists public.luziane_reabilitar_2026_patients
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists birth_date date,
  add column if not exists age text,
  add column if not exists guardian_name text,
  add column if not exists cpf text,
  add column if not exists mother_name text,
  add column if not exists father_name text,
  add column if not exists mother_phone text,
  add column if not exists father_phone text,
  add column if not exists education text,
  add column if not exists school_name text,
  add column if not exists school_type text,
  add column if not exists school_grade text,
  add column if not exists referred_by text,
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists important_notes text,
  add column if not exists status text not null default 'ativo',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Colunas de consultas usadas pelo app.
alter table if exists public.luziane_reabilitar_2026_appointments
  add column if not exists patient_name text,
  add column if not exists patient_phone text,
  add column if not exists patient_name_snapshot text,
  add column if not exists patient_phone_snapshot text,
  add column if not exists duration_minutes integer not null default 50,
  add column if not exists service_type text not null default 'Avaliação',
  add column if not exists status text not null default 'agendada',
  add column if not exists payment_status text not null default 'pendente',
  add column if not exists price numeric default null,
  add column if not exists room text,
  add column if not exists location text,
  add column if not exists notes text,
  add column if not exists private_notes text,
  add column if not exists recurrence_group_id text,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_index integer,
  add column if not exists recurrence_total integer,
  add column if not exists recurrence_original_date date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Se a tabela de configurações ainda não existir, cria sem apagar nada.
create table if not exists public.luziane_reabilitar_2026_settings (
  id text primary key default 'main',
  clinic_name text not null default 'LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA',
  start_time text not null default '08:00',
  end_time text not null default '18:00',
  default_duration integer not null default 50,
  default_price numeric default null,
  default_room text,
  default_service_type text default 'Avaliação',
  updated_at timestamptz not null default now()
);

insert into public.luziane_reabilitar_2026_settings (id, clinic_name, start_time, end_time, default_duration, default_price, default_room, default_service_type)
values ('main', 'LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA', '08:00', '18:00', 50, null, null, 'Avaliação')
on conflict (id) do nothing;

-- Sincroniza snapshot para o WhatsApp funcionar mesmo em consultas antigas.
update public.luziane_reabilitar_2026_appointments
set patient_name_snapshot = coalesce(patient_name_snapshot, patient_name),
    patient_phone_snapshot = coalesce(patient_phone_snapshot, patient_phone),
    patient_name = coalesce(patient_name, patient_name_snapshot),
    patient_phone = coalesce(patient_phone, patient_phone_snapshot)
where patient_name_snapshot is null
   or patient_phone_snapshot is null
   or patient_name is null
   or patient_phone is null;

-- Função de updated_at.
create or replace function public.luziane_reabilitar_2026_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Evita erro se triggers já existirem.
drop trigger if exists trg_luziane_reabilitar_2026_patients_updated_at on public.luziane_reabilitar_2026_patients;
create trigger trg_luziane_reabilitar_2026_patients_updated_at
before update on public.luziane_reabilitar_2026_patients
for each row execute function public.luziane_reabilitar_2026_set_updated_at();

drop trigger if exists trg_luziane_reabilitar_2026_appointments_updated_at on public.luziane_reabilitar_2026_appointments;
create trigger trg_luziane_reabilitar_2026_appointments_updated_at
before update on public.luziane_reabilitar_2026_appointments
for each row execute function public.luziane_reabilitar_2026_set_updated_at();

-- Função para manter telefone/nome duplicados de forma compatível.
create or replace function public.luziane_reabilitar_2026_sync_patient_snapshot()
returns trigger as $$
begin
  if new.patient_name is null and new.patient_name_snapshot is not null then new.patient_name = new.patient_name_snapshot; end if;
  if new.patient_name_snapshot is null and new.patient_name is not null then new.patient_name_snapshot = new.patient_name; end if;
  if new.patient_phone is null and new.patient_phone_snapshot is not null then new.patient_phone = new.patient_phone_snapshot; end if;
  if new.patient_phone_snapshot is null and new.patient_phone is not null then new.patient_phone_snapshot = new.patient_phone; end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_luziane_reabilitar_2026_sync_patient_snapshot on public.luziane_reabilitar_2026_appointments;
create trigger trg_luziane_reabilitar_2026_sync_patient_snapshot
before insert or update on public.luziane_reabilitar_2026_appointments
for each row execute function public.luziane_reabilitar_2026_sync_patient_snapshot();

-- Índices úteis. Não apagam nada.
create index if not exists luziane_reabilitar_2026_patients_full_name_idx on public.luziane_reabilitar_2026_patients(full_name);
create index if not exists luziane_reabilitar_2026_patients_phone_idx on public.luziane_reabilitar_2026_patients(phone);
create index if not exists luziane_reabilitar_2026_appointments_date_idx on public.luziane_reabilitar_2026_appointments(appointment_date);
create index if not exists luziane_reabilitar_2026_appointments_patient_id_idx on public.luziane_reabilitar_2026_appointments(patient_id);
create index if not exists luziane_reabilitar_2026_appointments_status_idx on public.luziane_reabilitar_2026_appointments(status);
create index if not exists luziane_reabilitar_2026_appointments_recurrence_idx on public.luziane_reabilitar_2026_appointments(recurrence_group_id);

create table if not exists public.luziane_reabilitar_2026_payments (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null references public.luziane_reabilitar_2026_appointments(id) on delete cascade,
 payment_date date not null,
 amount numeric not null check(amount > 0),
 payment_method text not null default 'pix',
 notes text,
 created_at timestamptz not null default now()
);
