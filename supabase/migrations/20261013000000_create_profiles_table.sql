-- ==============================================================================
-- Migration: 20261013000000_create_profiles_table.sql
-- Description: Creates the public.profiles table with Row Level Security (RLS),
-- least-privilege policies, and automated user synchronization triggers.
-- Phase: 2.3 Authorization, Security & Quality Gate
-- ==============================================================================

-- 1. Create the profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Comments for documentation and schema introspection
comment on table public.profiles is 'Trusted application user profiles with server-controlled role model';
comment on column public.profiles.role is 'System authorization role: admin (privileged) or employee (standard)';

-- Index frequently queried columns
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. Row Level Security Policies

-- Policy 1: Users can view their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Policy 2: Admins can view all profiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policy 3: Users can update their own profile (name, avatar only - role is protected)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policy 4: Admins can update any profile (e.g., managing roles)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policy 5: Service role has full unconstrained access
drop policy if exists "profiles_service_role_all" on public.profiles;
create policy "profiles_service_role_all"
  on public.profiles
  for all
  to service_role
  using (true)
  with check (true);

-- 4. Trigger to prevent role self-promotion
-- Enforces that non-admin callers cannot alter the 'role' column via UPDATE
create or replace function public.prevent_role_self_promotion()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    -- Allow service_role to update role
    if (auth.jwt() ->> 'role' is distinct from 'service_role') and
       not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      raise exception 'Unauthorized: Only administrators can modify user roles';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_role_self_promotion on public.profiles;
create trigger trg_prevent_role_self_promotion
  before update on public.profiles
  for each row
  execute function public.prevent_role_self_promotion();

-- 5. Trigger to automatically provision profile on user signup
-- Guarantees every new registered user is created with role 'employee'
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_url, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'employee', -- CRITICAL: Always default to employee regardless of any input metadata
    new.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
