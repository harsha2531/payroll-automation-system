import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Frontend Part 2: Employee EPF & payroll details migration", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261026000000_employee_epf_and_payroll_details.sql"
  );
  const profilesMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261013000000_create_profiles_table.sql"
  );

  const sql = fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, "utf-8")
    : "";

  it("ensures the forward-only migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(sql.length).toBeGreaterThan(400);
  });

  it("adds epf_number without dropping the employees table", () => {
    expect(sql).toContain("add column if not exists epf_number text");
    expect(sql).not.toMatch(/drop\s+table\s+.*employees/i);
    expect(sql).not.toMatch(/truncate\s+table/i);
  });

  it("enforces unique EPF values only when present", () => {
    expect(sql).toContain("uq_employees_epf_number");
    expect(sql).toContain("where epf_number is not null");
  });

  it("creates employee_payroll_details separate from monthly payroll_items", () => {
    expect(sql).toContain(
      "create table if not exists public.employee_payroll_details"
    );
    expect(sql).toContain("basic_salary numeric(12, 2)");
    expect(sql).toContain("allowances numeric(12, 2)");
    expect(sql).toContain(
      "employee_id uuid not null unique references public.employees(id) on delete cascade"
    );
    // Must not recreate or alter payroll_items monetary snapshot columns
    expect(sql).not.toContain("alter table public.payroll_items");
  });

  it("enables RLS with admin, own-select, and service_role policies", () => {
    expect(sql).toContain(
      "alter table public.employee_payroll_details enable row level security"
    );
    expect(sql).toContain("employee_payroll_details_admin_all");
    expect(sql).toContain("employee_payroll_details_select_own");
    expect(sql).toContain("employee_payroll_details_service_role_all");
  });

  it("does not modify the profiles table or its policies", () => {
    // Comments may mention profiles; executable DDL must not alter them.
    expect(sql.toLowerCase()).not.toMatch(
      /alter\s+table\s+public\.profiles/
    );
    expect(sql.toLowerCase()).not.toMatch(
      /create\s+policy\s+.*\s+on\s+public\.profiles/
    );
    expect(sql.toLowerCase()).not.toMatch(
      /drop\s+policy\s+.*\s+on\s+public\.profiles/
    );
    expect(fs.existsSync(profilesMigrationPath)).toBe(true);
  });

  it("uses exact numeric money types with non-negative checks", () => {
    expect(sql).not.toMatch(/\b(float|float4|float8|double precision)\b/i);
    expect(sql).toContain("check (basic_salary >= 0)");
    expect(sql).toContain("check (allowances >= 0)");
    expect(sql).toContain("check (variable_pay_amount >= 0)");
  });
});
