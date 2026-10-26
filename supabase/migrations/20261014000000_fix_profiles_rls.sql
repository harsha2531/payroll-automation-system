-- ===========================================================================
-- Migration: 20261014000000_fix_profiles_rls.sql
-- Description: Fix infinite recursion in profiles RLS policies by removing self-referential subqueries.
-- ===========================================================================

-- Drop the problematic admin select policy that queries the profiles table.
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
-- Recreate the admin select policy using JWT role claim.
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Drop the problematic admin update policy that queries the profiles table.
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
-- Recreate the admin update policy using JWT role claim.
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Ensure RLS is enabled (idempotent).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
