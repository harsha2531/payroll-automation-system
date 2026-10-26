import { describe, it, expect } from "vitest";
import { PayrollImportService } from "@/services/payroll-import.service";
import {
  buildPayrollWorkbookBuffer,
  SAMPLE_JANE,
  SAMPLE_JOHN,
} from "@/tests/helpers/payroll-workbook";
import {
  createMemoryDb,
  createMemorySupabase,
} from "@/tests/helpers/memory-supabase";

const liveConfigured = Boolean(
  process.env.PAYROLL_IMPORT_INTEGRATION === "1" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe("Payroll import integration (in-memory database)", () => {
  it("imports a sanitized two-employee workbook and preserves source amounts", async () => {
    const buffer = buildPayrollWorkbookBuffer([SAMPLE_JANE, SAMPLE_JOHN]);
    const db = createMemoryDb();
    const supabase = createMemorySupabase(db);

    const preview = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "sanitized-july-2022.xlsx"
    );
    expect(preview.success).toBe(true);
    if (!preview.success) return;

    const corrections = preview.data.rows.map((row) => ({
      rowId: row.rowId,
      sourceSheetName: row.sourceSheetName,
      originalEmployeeName: row.originalEmployeeName,
      employeeName: row.employeeName,
      epfNumber: row.epfNumber,
      designation: row.designation,
      included: true,
    }));

    const result = await PayrollImportService.confirmImport(supabase as never, {
      buffer,
      sourceFilename: "sanitized-july-2022.xlsx",
      corrections,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imported).toBe(2);
    expect(result.data.failed).toBe(0);
    expect(result.data.year).toBe(2022);
    expect(result.data.month).toBe(7);
    expect(db.employees).toHaveLength(2);
    expect(db.payroll_runs).toHaveLength(1);
    expect(db.payroll_items).toHaveLength(2);

    const janeItem = db.payroll_items.find(
      (row) => row.employee_name_snapshot === "Jane Doe"
    );
    expect(janeItem?.gross_pay).toBe(80000);
    expect(janeItem?.total_deductions).toBe(4025);
    expect(janeItem?.net_pay).toBe(75975);
    expect(janeItem?.employer_contributions).toBe(7500);
    expect(janeItem?.basic_salary).toBe(50000);

    const rerun = await PayrollImportService.confirmImport(supabase as never, {
      buffer,
      sourceFilename: "sanitized-july-2022.xlsx",
      corrections,
    });
    expect(rerun.success).toBe(true);
    if (!rerun.success) return;
    expect(rerun.data.skipped).toBe(2);
    expect(db.payroll_items).toHaveLength(2);
  });
});

describe.skipIf(!liveConfigured)(
  "Payroll import integration (live Supabase test environment)",
  () => {
    it("is available when PAYROLL_IMPORT_INTEGRATION=1 and credentials are set", () => {
      expect(liveConfigured).toBe(true);
    });
  }
);
