import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("server-only", () => ({}));

/**
 * Ensures updating current employee compensation defaults never writes to
 * monthly payroll_items (historical snapshots).
 */
describe("Historical payroll preservation when current details change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("upsertPayrollDetails only touches employee_payroll_details, never payroll_items", async () => {
    const existingDetails = {
      id: "det-1",
      employee_id: "emp-1",
      basic_salary: 50000,
      allowances: 2000,
      allowances_breakdown: {},
      variable_pay_label: null,
      variable_pay_amount: 0,
      notes: null,
      effective_from: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const updatedDetails = {
      ...existingDetails,
      basic_salary: 75000,
      updated_at: "2026-02-01T00:00:00Z",
    };

    const tablesTouched: string[] = [];
    let lookupCount = 0;

    const createBuilder = (table: string) => {
      const builder: Record<string, unknown> = {};
      const self = () => builder;

      builder.select = vi.fn(self);
      builder.eq = vi.fn(self);
      builder.update = vi.fn(self);
      builder.insert = vi.fn(self);
      builder.maybeSingle = vi.fn(async () => {
        if (table !== "employee_payroll_details") {
          throw new Error(`Unexpected maybeSingle on ${table}`);
        }
        lookupCount += 1;
        return {
          data: lookupCount === 1 ? existingDetails : null,
          error: null,
        };
      });
      builder.single = vi.fn(async () => {
        if (table !== "employee_payroll_details") {
          throw new Error(`Unexpected single on ${table}`);
        }
        return { data: updatedDetails, error: null };
      });

      return builder;
    };

    const mockFrom = vi.fn((table: string) => {
      tablesTouched.push(table);
      if (table === "payroll_items") {
        throw new Error(
          "payroll_items must not be accessed when updating current payroll details"
        );
      }
      if (table === "employees") {
        throw new Error(
          "employees table should not be written by upsertPayrollDetails"
        );
      }
      if (table !== "employee_payroll_details") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return createBuilder(table);
    });

    const { EmployeeRepository } = await import(
      "@/repositories/employee.repository"
    );

    const result = await EmployeeRepository.upsertPayrollDetails(
      { from: mockFrom } as never,
      "emp-1",
      { basicSalary: 75000, allowances: 2000 }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basicSalary).toBe(75000);
    }
    expect(tablesTouched.every((t) => t === "employee_payroll_details")).toBe(
      true
    );
    expect(tablesTouched).not.toContain("payroll_items");
  });

  it("EmployeeService.update with payrollDetails does not call payroll_items", async () => {
    const employeeRow = {
      id: "emp-1",
      employee_number: "EMP-1",
      full_name: "Test User",
      email: "test@example.com",
      designation: null,
      department: null,
      phone: null,
      epf_number: null,
      status: "active" as const,
      hire_date: null,
      termination_date: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const detailsRow = {
      id: "det-1",
      employee_id: "emp-1",
      basic_salary: 40000,
      allowances: 0,
      allowances_breakdown: {},
      variable_pay_label: null,
      variable_pay_amount: 0,
      notes: null,
      effective_from: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const tablesTouched: string[] = [];

    const createBuilder = (table: string) => {
      const builder: Record<string, unknown> = {};
      const self = () => builder;

      builder.select = vi.fn(self);
      builder.eq = vi.fn(self);
      builder.update = vi.fn(self);
      builder.insert = vi.fn(self);
      builder.maybeSingle = vi.fn(async () => {
        if (table === "employees") {
          return { data: employeeRow, error: null };
        }
        if (table === "employee_payroll_details") {
          return { data: detailsRow, error: null };
        }
        throw new Error(`Unexpected table in maybeSingle: ${table}`);
      });
      builder.single = vi.fn(async () => {
        if (table === "employees") {
          return {
            data: { ...employeeRow, full_name: "Test User Updated" },
            error: null,
          };
        }
        if (table === "employee_payroll_details") {
          return {
            data: { ...detailsRow, basic_salary: 55000 },
            error: null,
          };
        }
        throw new Error(`Unexpected table in single: ${table}`);
      });

      return builder;
    };

    const mockFrom = vi.fn((table: string) => {
      tablesTouched.push(table);
      if (table === "payroll_items") {
        throw new Error("Historical payroll_items must remain untouched");
      }
      return createBuilder(table);
    });

    const { EmployeeService } = await import("@/services/employee.service");

    const result = await EmployeeService.update(
      { from: mockFrom } as never,
      "emp-1",
      {
        fullName: "Test User Updated",
        payrollDetails: { basicSalary: 55000, allowances: 0 },
      }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Test User Updated");
      expect(result.data.payrollDetails?.basicSalary).toBe(55000);
    }
    expect(tablesTouched).not.toContain("payroll_items");
  });

  it("documents that payroll_items retain independent snapshot columns in schema", () => {
    const payrollSchema = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20261013010000_create_payroll_schema.sql"
      ),
      "utf-8"
    );

    expect(payrollSchema).toContain("employee_name_snapshot text not null");
    expect(payrollSchema).toContain("basic_salary numeric(12, 2)");
    expect(payrollSchema).toContain(
      "constraint uq_payroll_items_run_employee unique (payroll_run_id, employee_id)"
    );
  });
});
