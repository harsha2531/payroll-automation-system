-- Migration: Add error_message column to payroll_items
-- Description: Allows storing processing error details per payroll item.
-- Phase: 3.2 – Schema extension

ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS error_message text;

COMMENT ON COLUMN public.payroll_items.error_message IS 'Stores error details for payroll item processing failures.';

