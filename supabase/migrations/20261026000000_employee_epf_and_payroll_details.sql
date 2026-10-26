-- ==============================================================================
-- Migration: 20261026000000_employee_epf_and_payroll_details.sql
-- Description: Extends the employee master with optional EPF identity and a
-- separate current-compensation defaults table. Monthly payroll snapshots remain
-- on payroll_items and are not modified by this migration.
-- Phase: Frontend Part 2 — Employee Management and Database Preparation
--
-- MANUAL REVIEW NOTES (apply via `supabase db push` / migration pipeline only):
-- 1. Profiles table is intentionally untouched (columns, constraints, policies).
-- 2. No DROP/TRUNCATE of existing data tables.
-- 3. epf_number is nullable; uniqueness is enforced only when a value is present
--    (partial unique index). Review any pre-existing duplicate EPF values before
--    applying if you have already loaded employee data outside this schema.
-- 4. employee_payroll_details is additive (empty for existing employees until
--    defaults are set via the Employees UI or a later import step).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Employees: optional EPF number (identity field used by Excel/mapper pipeline)
-- ------------------------------------------------------------------------------
alter table public.employees
  add column if not exists epf_number text;

comment on column public.employees.epf_number is
  'Optional Employees Provident Fund (EPF) membership number. Distinct from organizational employee_number.';

-- Unique only when provided (PostgreSQL UNIQUE allows multiple NULLs; partial
-- index makes the business rule explicit and index-friendly for lookups).
create unique index if not exists uq_employees_epf_number
  on public.employees (epf_number)
  where epf_number is not null;

create index if not exists idx_employees_epf_number
  on public.employees (epf_number)
  where epf_number is not null;

-- ------------------------------------------------------------------------------
-- 2. Current employee payroll details (editable defaults; NOT monthly snapshots)
-- ------------------------------------------------------------------------------
-- Updating rows here must never rewrite historical payroll_items amounts.
create table if not exists public.employee_payroll_details (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,

  basic_salary numeric(12, 2) not null default 0.00 check (basic_salary >= 0),
  allowances numeric(12, 2) not null default 0.00 check (allowances >= 0),
  allowances_breakdown jsonb not null default '{}'::jsonb,
  variable_pay_label text,
  variable_pay_amount numeric(12, 2) not null default 0.00 check (variable_pay_amount >= 0),
  notes text,
  effective_from date,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.employee_payroll_details is
  'Current default compensation for an employee. Separate from monthly payroll_items snapshots.';
comment on column public.employee_payroll_details.basic_salary is
  'Current default basic salary. Changing this does not alter historical payroll_items.';
comment on column public.employee_payroll_details.allowances is
  'Current default total allowances amount.';
comment on column public.employee_payroll_details.allowances_breakdown is
  'Optional named allowance components for the current default package.';
comment on column public.employee_payroll_details.effective_from is
  'Optional date from which the current defaults are considered in effect.';

create index if not exists idx_employee_payroll_details_employee
  on public.employee_payroll_details (employee_id);

drop trigger if exists trg_employee_payroll_details_updated_at on public.employee_payroll_details;
create trigger trg_employee_payroll_details_updated_at
  before update on public.employee_payroll_details
  for each row execute function public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Row Level Security (mirror employees: admin ALL, own SELECT, service_role ALL)
-- ------------------------------------------------------------------------------
alter table public.employee_payroll_details enable row level security;

drop policy if exists "employee_payroll_details_admin_all" on public.employee_payroll_details;
create policy "employee_payroll_details_admin_all"
  on public.employee_payroll_details
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "employee_payroll_details_select_own" on public.employee_payroll_details;
create policy "employee_payroll_details_select_own"
  on public.employee_payroll_details
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employees e
      join public.profiles p on p.email = e.email
      where p.id = auth.uid()
        and e.id = public.employee_payroll_details.employee_id
    )
  );

drop policy if exists "employee_payroll_details_service_role_all" on public.employee_payroll_details;
create policy "employee_payroll_details_service_role_all"
  on public.employee_payroll_details
  for all
  to service_role
  using (true)
  with check (true);
