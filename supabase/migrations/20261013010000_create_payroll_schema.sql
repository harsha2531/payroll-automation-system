-- ==============================================================================
-- Migration: 20261013010000_create_payroll_schema.sql
-- Description: Core schema for Payroll Automation (Employees, Payroll Runs,
-- Payroll Items, Payslip Documents, Email Deliveries, Processing Jobs).
-- Phase: 3.1 — Database Schema and Migrations
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Helper Trigger Function: Automatically refresh updated_at timestamp
-- ------------------------------------------------------------------------------
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- ==============================================================================
-- 1. EMPLOYEES TABLE
-- ==============================================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  full_name text not null,
  email text not null,
  designation text,
  department text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'terminated', 'on_leave')),
  hire_date date,
  termination_date date check (termination_date is null or termination_date >= hire_date),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.employees is 'Master employee registry containing essential employment and communication records.';
comment on column public.employees.employee_number is 'Unique organizational employee identifier/badge number.';
comment on column public.employees.status is 'Current employment lifecycle state: active, inactive, terminated, on_leave.';

create index if not exists idx_employees_number on public.employees(employee_number);
create index if not exists idx_employees_email on public.employees(email);
create index if not exists idx_employees_status on public.employees(status);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 2. PAYROLL RUNS TABLE
-- ==============================================================================
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month between 1 and 12),
  sequence_number integer not null default 1 check (sequence_number >= 1),
  run_type text not null default 'regular' check (run_type in ('regular', 'supplementary', 'correction', 'bonus')),
  status text not null default 'draft' check (status in ('draft', 'processing', 'calculated', 'approved', 'completed', 'failed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  source_filename text,
  import_metadata jsonb not null default '{}'::jsonb,
  total_employees integer not null default 0 check (total_employees >= 0),
  total_gross_pay numeric(14, 2) not null default 0.00 check (total_gross_pay >= 0),
  total_deductions numeric(14, 2) not null default 0.00 check (total_deductions >= 0),
  total_net_pay numeric(14, 2) not null default 0.00 check (total_net_pay >= 0),
  notes text,
  error_message text,
  approved_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_payroll_runs_period_sequence unique (year, month, sequence_number)
);

comment on table public.payroll_runs is 'Payroll execution batches per period. Supports corrections/reruns via sequence_number.';
comment on column public.payroll_runs.sequence_number is 'Incremented sequence for the period allowing supplementary or correction runs without overwriting history.';
comment on column public.payroll_runs.import_metadata is 'Audit details regarding source spreadsheet, row counts, and upload headers.';

create index if not exists idx_payroll_runs_period on public.payroll_runs(year, month);
create index if not exists idx_payroll_runs_status on public.payroll_runs(status);

drop trigger if exists trg_payroll_runs_updated_at on public.payroll_runs;
create trigger trg_payroll_runs_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 3. PAYROLL ITEMS TABLE
-- ==============================================================================
create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,

  -- Historical employee details snapshot (ensures payslip immutability if employee details change later)
  employee_number_snapshot text not null,
  employee_name_snapshot text not null,
  employee_email_snapshot text not null,
  designation_snapshot text,
  department_snapshot text,

  -- Explicit monetary amounts (exact PostgreSQL numeric, non-floating)
  basic_salary numeric(12, 2) not null default 0.00 check (basic_salary >= 0),
  variable_pay_label text,
  variable_pay_amount numeric(12, 2) not null default 0.00 check (variable_pay_amount >= 0),
  allowances numeric(12, 2) not null default 0.00 check (allowances >= 0),
  gross_pay numeric(12, 2) not null default 0.00 check (gross_pay >= 0),
  total_deductions numeric(12, 2) not null default 0.00 check (total_deductions >= 0),
  employer_contributions numeric(12, 2) not null default 0.00 check (employer_contributions >= 0),
  net_pay numeric(12, 2) not null check (net_pay >= 0),

  -- Breakdown & source metadata preserving Excel import vs computed items
  earnings_breakdown jsonb not null default '{}'::jsonb,
  deductions_breakdown jsonb not null default '{}'::jsonb,
  calculation_metadata jsonb not null default '{}'::jsonb,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint uq_payroll_items_run_employee unique (payroll_run_id, employee_id)
);

comment on table public.payroll_items is 'Itemized payroll line items per employee per run. Preserves historical snapshot and calculation metadata.';
comment on column public.payroll_items.variable_pay_label is 'Human-readable label for variable additions (e.g., Over Time, Bonus, Commission).';
comment on column public.payroll_items.calculation_metadata is 'Source tracking distinguishing imported Excel cell inputs from system-computed outputs.';

create index if not exists idx_payroll_items_run on public.payroll_items(payroll_run_id);
create index if not exists idx_payroll_items_employee on public.payroll_items(employee_id);

drop trigger if exists trg_payroll_items_updated_at on public.payroll_items;
create trigger trg_payroll_items_updated_at
  before update on public.payroll_items
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 4. PAYSLIP DOCUMENTS TABLE
-- ==============================================================================
create table if not exists public.payslip_documents (
  id uuid primary key default gen_random_uuid(),
  payroll_item_id uuid not null unique references public.payroll_items(id) on delete restrict,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
  storage_bucket text not null default 'payslips',
  storage_path text not null unique,
  file_name text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  file_hash text,
  mime_type text not null default 'application/pdf',
  status text not null default 'pending' check (status in ('pending', 'generated', 'failed')),
  error_message text,
  generated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.payslip_documents is 'Metadata for generated PDF payslips in private object storage. No public URLs stored permanently.';
comment on column public.payslip_documents.storage_path is 'Relative path in private storage bucket used to generate temporary signed URLs.';

create index if not exists idx_payslip_docs_item on public.payslip_documents(payroll_item_id);
create index if not exists idx_payslip_docs_run on public.payslip_documents(payroll_run_id);
create index if not exists idx_payslip_docs_status on public.payslip_documents(status);

drop trigger if exists trg_payslip_documents_updated_at on public.payslip_documents;
create trigger trg_payslip_documents_updated_at
  before update on public.payslip_documents
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 5. EMAIL DELIVERIES TABLE
-- ==============================================================================
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  payroll_item_id uuid not null references public.payroll_items(id) on delete restrict,
  payslip_document_id uuid references public.payslip_documents(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced')),
  provider text not null default 'brevo',
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  error_message text,
  error_details jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  sent_at timestamp with time zone,
  last_attempt_at timestamp with time zone,
  next_retry_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.email_deliveries is 'Audit log for transactional email transmissions with retry state and duplicate-send prevention.';
comment on column public.email_deliveries.idempotency_key is 'Unique dispatch token preventing duplicate emails across retry attempts.';

create index if not exists idx_email_deliveries_item on public.email_deliveries(payroll_item_id);
create index if not exists idx_email_deliveries_status on public.email_deliveries(delivery_status);
create index if not exists idx_email_deliveries_recipient on public.email_deliveries(recipient_email);

drop trigger if exists trg_email_deliveries_updated_at on public.email_deliveries;
create trigger trg_email_deliveries_updated_at
  before update on public.email_deliveries
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 6. PROCESSING JOBS TABLE (Database-backed Queue)
-- ==============================================================================
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('payroll_import', 'payroll_calculation', 'payslip_pdf_generation', 'email_dispatch', 'bulk_email_dispatch')),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'processing', 'completed', 'failed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  error_details jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  available_at timestamp with time zone default timezone('utc'::text, now()) not null,
  claimed_at timestamp with time zone,
  claimed_by text,
  locked_until timestamp with time zone,
  idempotency_key text unique,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.processing_jobs is 'Database-backed job queue for background payroll calculation, PDF generation, and batch email dispatch.';
comment on column public.processing_jobs.locked_until is 'Lease expiration timestamp allowing automatic stale job reclamation if a worker crashes.';

-- Partial index for high-speed atomic job claiming (due jobs ready for pickup)
create index if not exists idx_processing_jobs_due on public.processing_jobs(status, available_at)
  where status in ('queued', 'failed');

-- Partial index for recovering abandoned/stale claimed jobs
create index if not exists idx_processing_jobs_stale on public.processing_jobs(status, locked_until)
  where status in ('claimed', 'processing');

drop trigger if exists trg_processing_jobs_updated_at on public.processing_jobs;
create trigger trg_processing_jobs_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
alter table public.employees enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.payslip_documents enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.processing_jobs enable row level security;

-- ------------------------------------------------------------------------------
-- Employees RLS Policies
-- ------------------------------------------------------------------------------
drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all"
  on public.employees
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "employees_select_own" on public.employees;
create policy "employees_select_own"
  on public.employees
  for select
  to authenticated
  using (
    email = (select email from public.profiles where id = auth.uid())
  );

drop policy if exists "employees_service_role_all" on public.employees;
create policy "employees_service_role_all"
  on public.employees
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Payroll Runs RLS Policies
-- ------------------------------------------------------------------------------
drop policy if exists "payroll_runs_admin_all" on public.payroll_runs;
create policy "payroll_runs_admin_all"
  on public.payroll_runs
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "payroll_runs_service_role_all" on public.payroll_runs;
create policy "payroll_runs_service_role_all"
  on public.payroll_runs
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Payroll Items RLS Policies
-- ------------------------------------------------------------------------------
drop policy if exists "payroll_items_admin_all" on public.payroll_items;
create policy "payroll_items_admin_all"
  on public.payroll_items
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "payroll_items_select_own" on public.payroll_items;
create policy "payroll_items_select_own"
  on public.payroll_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employees e
      join public.profiles p on p.email = e.email
      where p.id = auth.uid() and e.id = public.payroll_items.employee_id
    )
  );

drop policy if exists "payroll_items_service_role_all" on public.payroll_items;
create policy "payroll_items_service_role_all"
  on public.payroll_items
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Payslip Documents RLS Policies
-- ------------------------------------------------------------------------------
drop policy if exists "payslip_documents_admin_all" on public.payslip_documents;
create policy "payslip_documents_admin_all"
  on public.payslip_documents
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "payslip_documents_select_own" on public.payslip_documents;
create policy "payslip_documents_select_own"
  on public.payslip_documents
  for select
  to authenticated
  using (
    exists (
      select 1 from public.payroll_items pi
      join public.employees e on e.id = pi.employee_id
      join public.profiles p on p.email = e.email
      where p.id = auth.uid() and pi.id = public.payslip_documents.payroll_item_id
    )
  );

drop policy if exists "payslip_documents_service_role_all" on public.payslip_documents;
create policy "payslip_documents_service_role_all"
  on public.payslip_documents
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Email Deliveries RLS Policies
-- ------------------------------------------------------------------------------
drop policy if exists "email_deliveries_admin_all" on public.email_deliveries;
create policy "email_deliveries_admin_all"
  on public.email_deliveries
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "email_deliveries_service_role_all" on public.email_deliveries;
create policy "email_deliveries_service_role_all"
  on public.email_deliveries
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Processing Jobs RLS Policies (strictly administrative / backend worker queue)
-- ------------------------------------------------------------------------------
drop policy if exists "processing_jobs_admin_all" on public.processing_jobs;
create policy "processing_jobs_admin_all"
  on public.processing_jobs
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "processing_jobs_service_role_all" on public.processing_jobs;
create policy "processing_jobs_service_role_all"
  on public.processing_jobs
  for all
  to service_role
  using (true)
  with check (true);
