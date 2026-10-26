-- Aplicar somente no banco exclusivo da Luziane; não executar no banco NEXOR.
create table if not exists public.luziane_reabilitar_2026_packages (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.luziane_reabilitar_2026_patients(id) on delete restrict,
 description text not null,
 total_amount numeric(12,2) not null check(total_amount>0),
 due_date date, notes text,
 created_at timestamptz not null default now()
);
alter table public.luziane_reabilitar_2026_payments add column if not exists package_id uuid references public.luziane_reabilitar_2026_packages(id) on delete restrict;
alter table public.luziane_reabilitar_2026_payments alter column appointment_id drop not null;
alter table public.luziane_reabilitar_2026_payments drop constraint if exists luziane_payment_target_chk;
alter table public.luziane_reabilitar_2026_payments add constraint luziane_payment_target_chk check ((appointment_id is not null and package_id is null) or (appointment_id is null and package_id is not null));
-- Permissões e RLS devem ser configuradas antes de armazenar dados reais.
