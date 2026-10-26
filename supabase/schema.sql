-- ============================================================
-- RESET TOTAL - LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA COM RECORRÊNCIA
-- CUIDADO: ESTE SQL APAGA TODOS OS DADOS ANTIGOS
-- Prefixo exclusivo: luziane_reabilitar_2026_
-- ============================================================

create extension if not exists pgcrypto;

drop table if exists public.luziane_reabilitar_2026_payments cascade;
drop table if exists public.luziane_reabilitar_2026_tasks cascade;
drop table if exists public.luziane_reabilitar_2026_appointments cascade;
drop table if exists public.luziane_reabilitar_2026_patients cascade;
drop table if exists public.luziane_reabilitar_2026_settings cascade;

drop function if exists public.luziane_reabilitar_2026_set_updated_at() cascade;
drop function if exists public.luziane_reabilitar_2026_sync_patient_snapshot() cascade;

create table public.luziane_reabilitar_2026_patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  whatsapp text,
  birth_date date,
  age text,
  guardian_name text,
  cpf text,
  mother_name text,
  father_name text,
  mother_phone text,
  father_phone text,
  education text,
  school_name text,
  school_type text,
  school_grade text,
  referred_by text,
  email text,
  notes text,
  important_notes text,
  status text not null default 'ativo' check (status in ('ativo', 'em_avaliacao', 'finalizado', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.luziane_reabilitar_2026_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.luziane_reabilitar_2026_patients(id) on delete set null,
  patient_name text,
  patient_phone text,
  patient_name_snapshot text,
  patient_phone_snapshot text,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 50 check (duration_minutes >= 0),
  service_type text not null default 'Avaliação',
  status text not null default 'agendada' check (status in ('agendada', 'aguardando_confirmacao', 'confirmada', 'realizada', 'remarcada', 'faltou', 'cancelada')),
  payment_status text not null default 'pendente' check (payment_status in ('pago', 'pendente', 'cortesia')),
  price numeric default null check (price is null or price >= 0),
  room text,
  location text,
  notes text,
  private_notes text,
  recurrence_group_id text,
  recurrence_frequency text check (recurrence_frequency is null or recurrence_frequency in ('weekly', 'biweekly', 'monthly')),
  recurrence_index integer check (recurrence_index is null or recurrence_index >= 1),
  recurrence_total integer check (recurrence_total is null or recurrence_total >= 1),
  recurrence_original_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.luziane_reabilitar_2026_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.luziane_reabilitar_2026_appointments(id) on delete cascade,
  payment_date date not null,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'pix',
  notes text,
  created_at timestamptz not null default now()
);

create table public.luziane_reabilitar_2026_settings (
  id text primary key default 'main',
  clinic_name text not null default 'LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA',
  start_time text not null default '08:00',
  end_time text not null default '18:00',
  default_duration integer not null default 50 check (default_duration >= 0),
  default_price numeric default null check (default_price is null or default_price >= 0),
  default_room text,
  default_service_type text default 'Avaliação',
  updated_at timestamptz not null default now()
);

create table public.luziane_reabilitar_2026_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_date date,
  task_time time,
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.luziane_reabilitar_2026_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_luziane_reabilitar_2026_patients_updated_at before update on public.luziane_reabilitar_2026_patients for each row execute function public.luziane_reabilitar_2026_set_updated_at();
create trigger trg_luziane_reabilitar_2026_appointments_updated_at before update on public.luziane_reabilitar_2026_appointments for each row execute function public.luziane_reabilitar_2026_set_updated_at();
create trigger trg_luziane_reabilitar_2026_tasks_updated_at before update on public.luziane_reabilitar_2026_tasks for each row execute function public.luziane_reabilitar_2026_set_updated_at();

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

create trigger trg_luziane_reabilitar_2026_sync_patient_snapshot before insert or update on public.luziane_reabilitar_2026_appointments for each row execute function public.luziane_reabilitar_2026_sync_patient_snapshot();

insert into public.luziane_reabilitar_2026_settings (id, clinic_name, start_time, end_time, default_duration, default_price, default_room, default_service_type)
values ('main', 'LUZIANE MUZZI LAGE — REABILITAR PSICOLOGIA', '08:00', '18:00', 50, null, null, 'Avaliação');

alter table public.luziane_reabilitar_2026_patients enable row level security;
alter table public.luziane_reabilitar_2026_appointments enable row level security;
alter table public.luziane_reabilitar_2026_settings enable row level security;
alter table public.luziane_reabilitar_2026_tasks enable row level security;

create policy "luziane_reabilitar_2026_patients_all" on public.luziane_reabilitar_2026_patients for all using (true) with check (true);
create policy "luziane_reabilitar_2026_appointments_all" on public.luziane_reabilitar_2026_appointments for all using (true) with check (true);
create policy "luziane_reabilitar_2026_settings_all" on public.luziane_reabilitar_2026_settings for all using (true) with check (true);
create policy "luziane_reabilitar_2026_tasks_all" on public.luziane_reabilitar_2026_tasks for all using (true) with check (true);

create index luziane_reabilitar_2026_patients_full_name_idx on public.luziane_reabilitar_2026_patients(full_name);
create index luziane_reabilitar_2026_patients_phone_idx on public.luziane_reabilitar_2026_patients(phone);
create index luziane_reabilitar_2026_appointments_date_idx on public.luziane_reabilitar_2026_appointments(appointment_date);
create index luziane_reabilitar_2026_appointments_patient_id_idx on public.luziane_reabilitar_2026_appointments(patient_id);
create index luziane_reabilitar_2026_appointments_status_idx on public.luziane_reabilitar_2026_appointments(status);
create index luziane_reabilitar_2026_appointments_recurrence_idx on public.luziane_reabilitar_2026_appointments(recurrence_group_id);
create index luziane_reabilitar_2026_tasks_date_idx on public.luziane_reabilitar_2026_tasks(task_date);
