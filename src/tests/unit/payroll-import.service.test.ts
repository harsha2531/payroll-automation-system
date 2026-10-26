import { describe, it, expect } from "vitest";
import { parsePayrollWorkbook } from "@/services/payroll-parser";
import {
  parseWorkbookRecords,
  PayrollImportService,
} from "@/services/payroll-import.service";
import {
  buildPayrollWorkbookBuffer,
  SAMPLE_JANE,
  SAMPLE_JOHN,
} from "@/tests/helpers/payroll-workbook";
import {
  createMemoryDb,
  createMemorySupabase,
  sampleEmployeeRow,
} from "@/tests/helpers/memory-supabase";

describe("Payroll import service", () => {
  it("returns a parse error for a ZIP-like buffer that is not a workbook", async () => {
    const result = parseWorkbookRecords(
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00])
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/could not be parsed|valid \.xlsx|No employee/i);
    }
  });

  it("builds a preview with extracted amounts and mapper warnings preserved", async () => {
    const buffer = buildPayrollWorkbookBuffer([SAMPLE_JANE, SAMPLE_JOHN]);
    const parsed = parsePayrollWorkbook(buffer);
    expect(parsed.length).toBeGreaterThanOrEqual(2);

    const jane = parsed.find((r) => r.employeeName?.includes("Jane"));
    expect(jane?.grossSalary).toBe(80000);
    expect(jane?.netSalary).toBe(75975);
    expect(jane?.totalDeductions).toBe(4025);
    expect(jane?.employerEpf).toBe(6000);
    expect(jane?.employerEtf).toBe(1500);

    const supabase = createMemorySupabase(createMemoryDb());
    const preview = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "july.xlsx"
    );

    expect(preview.success).toBe(true);
    if (!preview.success) return;

    expect(preview.data.year).toBe(2022);
    expect(preview.data.month).toBe(7);
    expect(preview.data.rows).toHaveLength(2);

    const janeRow = preview.data.rows.find((r) =>
      r.employeeName.includes("Jane")
    );
    expect(janeRow?.amounts.grossPay).toBe(80000);
    expect(janeRow?.amounts.netPay).toBe(75975);
    expect(janeRow?.amounts.employerContributions).toBe(7500);
    expect(janeRow?.disposition).toBe("import_new_employee");
    expect(janeRow?.warnings.length).toBeGreaterThan(0);
    expect(janeRow?.warnings.join(" ")).toMatch(/Gross Salary/);
  });

  it("skips duplicate employee+period payroll without overwriting", async () => {
    const buffer = buildPayrollWorkbookBuffer([SAMPLE_JANE]);
    const db = createMemoryDb({
      employees: [sampleEmployeeRow()],
      payroll_runs: [
        {
          id: "run-july",
          year: 2022,
          month: 7,
          sequence_number: 1,
          run_type: "regular",
          status: "calculated",
          created_by: null,
          approved_by: null,
          source_filename: "prior.xlsx",
          import_metadata: {},
          total_employees: 1,
          total_gross_pay: 80000,
          total_deductions: 4025,
          total_net_pay: 75975,
          notes: null,
          error_message: null,
          approved_at: null,
          completed_at: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      payroll_items: [
        {
          id: "item-jane-july",
          payroll_run_id: "run-july",
          employee_id: "emp-jane",
          employee_number_snapshot: "EPF-123",
          employee_name_snapshot: "Jane Doe",
          employee_email_snapshot: "jane@example.com",
          designation_snapshot: "Software Engineer",
          department_snapshot: null,
          basic_salary: 50000,
          variable_pay_label: "Over Time",
          variable_pay_amount: 2500,
          allowances: 10000,
          gross_pay: 80000,
          total_deductions: 4025,
          employer_contributions: 7500,
          net_pay: 75975,
          earnings_breakdown: {},
          deductions_breakdown: {},
          calculation_metadata: {},
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    const supabase = createMemorySupabase(db);

    const preview = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "july.xlsx"
    );
    expect(preview.success).toBe(true);
    if (!preview.success) return;
    expect(preview.data.rows[0]?.disposition).toBe("skip_duplicate_period");
    expect(preview.data.rows[0]?.identityMatch).toBe("epf");

    const confirmed = await PayrollImportService.confirmImport(
      supabase as never,
      {
        buffer,
        sourceFilename: "july.xlsx",
        corrections: [
          {
            rowId: preview.data.rows[0].rowId,
            sourceSheetName: preview.data.rows[0].sourceSheetName,
            originalEmployeeName: preview.data.rows[0].originalEmployeeName,
            included: true,
          },
        ],
      }
    );

    expect(confirmed.success).toBe(true);
    if (!confirmed.success) return;
    expect(confirmed.data.skipped).toBe(1);
    expect(confirmed.data.imported).toBe(0);
    expect(db.payroll_items).toHaveLength(1);
    expect(db.employees[0]?.full_name).toBe("Jane Doe");
  });

  it("does not overwrite existing employee details unless explicitly requested", async () => {
    const buffer = buildPayrollWorkbookBuffer([
      { ...SAMPLE_JANE, designation: "Director" },
    ]);
    const db = createMemoryDb({
      employees: [sampleEmployeeRow({ designation: "Software Engineer" })],
    });
    const supabase = createMemorySupabase(db);

    const preview = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "july.xlsx"
    );
    expect(preview.success).toBe(true);
    if (!preview.success) return;
    expect(preview.data.rows[0]?.disposition).toBe("import_existing_employee");

    const confirmed = await PayrollImportService.confirmImport(
      supabase as never,
      {
        buffer,
        sourceFilename: "july.xlsx",
        corrections: [
          {
            rowId: preview.data.rows[0].rowId,
            sourceSheetName: preview.data.rows[0].sourceSheetName,
            originalEmployeeName: preview.data.rows[0].originalEmployeeName,
            included: true,
            applyEmployeeUpdates: false,
          },
        ],
      }
    );

    expect(confirmed.success).toBe(true);
    if (!confirmed.success) return;
    expect(confirmed.data.imported).toBe(1);
    expect(db.employees[0]?.designation).toBe("Software Engineer");
    expect(db.payroll_items).toHaveLength(1);
    expect(db.payroll_items[0]?.gross_pay).toBe(80000);
    expect(db.payroll_runs[0]?.year).toBe(2022);
    expect(db.payroll_runs[0]?.month).toBe(7);
  });
});
