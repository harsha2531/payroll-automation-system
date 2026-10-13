import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 3.1: Database Schema & Migration Specification", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261013010000_create_payroll_schema.sql"
  );

  it("ensures migration file exists and is populated", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql.length).toBeGreaterThan(500);
  });

  const sql = fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, "utf-8")
    : "";

  describe("1. Table Creation and Primary Keys", () => {
    it("defines UUID primary keys with gen_random_uuid for all 6 entities", () => {
      const requiredTables = [
        "public.employees",
        "public.payroll_runs",
        "public.payroll_items",
        "public.payslip_documents",
        "public.email_deliveries",
        "public.processing_jobs",
      ];

      for (const table of requiredTables) {
        expect(sql).toContain(`create table if not exists ${table}`);
      }

      // Check UUID primary key pattern
      expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/g);
    });
  });

  describe("2. Uniqueness and Period Constraints", () => {
    it("enforces unique employee identifier constraint", () => {
      expect(sql).toContain("employee_number text not null unique");
    });

    it("enforces period and sequence uniqueness to support corrections and reruns", () => {
      expect(sql).toContain(
        "constraint uq_payroll_runs_period_sequence unique (year, month, sequence_number)"
      );
    });

    it("prevents accidental duplicate employee entries within the same payroll run", () => {
      expect(sql).toContain(
        "constraint uq_payroll_items_run_employee unique (payroll_run_id, employee_id)"
      );
    });

    it("enforces uniqueness on payslip document payroll_item_id and storage path", () => {
      expect(sql).toContain("payroll_item_id uuid not null unique");
      expect(sql).toContain("storage_path text not null unique");
    });

    it("enforces idempotency key uniqueness for email deliveries and processing jobs", () => {
      expect(sql).toContain("idempotency_key text not null unique");
      expect(sql).toContain("idempotency_key text unique");
    });
  });

  describe("3. Foreign Keys and Deletion Protection (Auditability)", () => {
    it("protects historical payroll records against accidental cascading deletion", () => {
      // Must use ON DELETE RESTRICT on payroll_items referencing payroll_runs and employees
      expect(sql).toContain(
        "payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict"
      );
      expect(sql).toContain(
        "employee_id uuid not null references public.employees(id) on delete restrict"
      );

      // Payslip documents must also be protected from accidental cascading deletion
      expect(sql).toContain(
        "payroll_item_id uuid not null unique references public.payroll_items(id) on delete restrict"
      );
      expect(sql).toContain(
        "payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict"
      );
    });

    it("preserves auditability when users are removed", () => {
      expect(sql).toContain(
        "created_by uuid references auth.users(id) on delete set null"
      );
      expect(sql).toContain(
        "approved_by uuid references auth.users(id) on delete set null"
      );
    });
  });

  describe("4. Exact Monetary Columns (Numeric/Decimal)", () => {
    it("uses exact PostgreSQL numeric types, never floating point", () => {
      // Ensure no float or double precision is used for column types in SQL
      expect(sql).not.toMatch(/\b(float|float4|float8|double precision)\b/i);

      const monetaryFields = [
        "basic_salary numeric(12, 2)",
        "variable_pay_amount numeric(12, 2)",
        "allowances numeric(12, 2)",
        "gross_pay numeric(12, 2)",
        "total_deductions numeric(12, 2)",
        "employer_contributions numeric(12, 2)",
        "net_pay numeric(12, 2)",
        "total_gross_pay numeric(14, 2)",
        "total_deductions numeric(14, 2)",
        "total_net_pay numeric(14, 2)",
      ];

      for (const field of monetaryFields) {
        expect(sql).toContain(field);
      }
    });

    it("enforces non-negative check constraints on monetary columns", () => {
      expect(sql).toContain("check (basic_salary >= 0)");
      expect(sql).toContain("check (variable_pay_amount >= 0)");
      expect(sql).toContain("check (allowances >= 0)");
      expect(sql).toContain("check (gross_pay >= 0)");
      expect(sql).toContain("check (total_deductions >= 0)");
      expect(sql).toContain("check (employer_contributions >= 0)");
      expect(sql).toContain("check (net_pay >= 0)");
    });
  });

  describe("5. Historical Snapshot & Variable Pay Support", () => {
    it("includes required employee snapshot columns for historical payslip immutability", () => {
      expect(sql).toContain("employee_number_snapshot text not null");
      expect(sql).toContain("employee_name_snapshot text not null");
      expect(sql).toContain("employee_email_snapshot text not null");
      expect(sql).toContain("designation_snapshot text");
      expect(sql).toContain("department_snapshot text");
    });

    it("supports customizable variable pay label and amount", () => {
      expect(sql).toContain("variable_pay_label text");
      expect(sql).toContain("variable_pay_amount numeric(12, 2)");
    });

    it("preserves Excel import vs application calculation metadata distinctions", () => {
      expect(sql).toContain("earnings_breakdown jsonb not null default '{}'::jsonb");
      expect(sql).toContain("deductions_breakdown jsonb not null default '{}'::jsonb");
      expect(sql).toContain("calculation_metadata jsonb not null default '{}'::jsonb");
    });
  });

  describe("6. Private Document Storage Paths (No Public URLs)", () => {
    it("stores private storage bucket and relative path without public URLs", () => {
      expect(sql).toContain("storage_bucket text not null default 'payslips'");
      expect(sql).toContain("storage_path text not null unique");
      expect(sql).not.toContain("public_url");
      expect(sql).not.toContain("download_url");
    });
  });

  describe("7. Status Lifecycle Checks", () => {
    it("enforces allowed status values for all lifecycle entities", () => {
      // Employees
      expect(sql).toContain(
        "check (status in ('active', 'inactive', 'terminated', 'on_leave'))"
      );
      // Payroll runs
      expect(sql).toContain(
        "check (status in ('draft', 'processing', 'calculated', 'approved', 'completed', 'failed', 'cancelled'))"
      );
      expect(sql).toContain(
        "check (run_type in ('regular', 'supplementary', 'correction', 'bonus'))"
      );
      // Payslip documents
      expect(sql).toContain(
        "check (status in ('pending', 'generated', 'failed'))"
      );
      // Email deliveries
      expect(sql).toContain(
        "check (delivery_status in ('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced'))"
      );
      // Processing jobs
      expect(sql).toContain(
        "check (status in ('queued', 'claimed', 'processing', 'completed', 'failed', 'cancelled'))"
      );
      expect(sql).toContain(
        "check (job_type in ('payroll_import', 'payroll_calculation', 'payslip_pdf_generation', 'email_dispatch', 'bulk_email_dispatch'))"
      );
    });
  });

  describe("8. Processing Job Queue Mechanics", () => {
    it("includes fields required for atomic claiming, lease locks, and stale recovery", () => {
      expect(sql).toContain("available_at timestamp with time zone");
      expect(sql).toContain("claimed_at timestamp with time zone");
      expect(sql).toContain("claimed_by text");
      expect(sql).toContain("locked_until timestamp with time zone");
      expect(sql).toContain("attempts integer not null default 0");
      expect(sql).toContain("max_attempts integer not null default 3");
    });

    it("includes partial indexes for due job queries and stale job recovery", () => {
      expect(sql).toContain("idx_processing_jobs_due");
      expect(sql).toContain("idx_processing_jobs_stale");
    });
  });

  describe("9. Row Level Security (RLS) Coverage", () => {
    it("enables RLS on all 6 tables", () => {
      const rlsTables = [
        "employees",
        "payroll_runs",
        "payroll_items",
        "payslip_documents",
        "email_deliveries",
        "processing_jobs",
      ];

      for (const table of rlsTables) {
        expect(sql).toContain(`alter table public.${table} enable row level security;`);
      }
    });

    it("defines least-privilege policies adhering to the Phase 2 admin authorization model", () => {
      expect(sql).toContain("employees_admin_all");
      expect(sql).toContain("employees_select_own");
      expect(sql).toContain("payroll_runs_admin_all");
      expect(sql).toContain("payroll_items_admin_all");
      expect(sql).toContain("payroll_items_select_own");
      expect(sql).toContain("payslip_documents_admin_all");
      expect(sql).toContain("payslip_documents_select_own");
      expect(sql).toContain("email_deliveries_admin_all");
      expect(sql).toContain("processing_jobs_admin_all");
    });
  });
});
