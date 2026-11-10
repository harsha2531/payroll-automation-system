import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parsePayrollWorkbook } from "@/services/payroll-parser";
import { PayrollImportService } from "@/services/payroll-import.service";
import { createMemoryDb, createMemorySupabase } from "@/tests/helpers/memory-supabase";
import { buildPayrollWorkbookBuffer, type SamplePayslipInput } from "@/tests/helpers/payroll-workbook";

const fixturePath = path.resolve(
  __dirname,
  "../../tests/fixtures/July 2022-Datafield Ssalary-NOW.xlsx"
);

describe("Employee saving process and Preview Import email display", () => {
  it("parses July 2022 fixture with correct staff categories, EPF numbers, and emails for all employees", () => {
    const buffer = fs.readFileSync(fixturePath);
    const records = parsePayrollWorkbook(buffer);

    expect(records.length).toBe(5);

    // 1. First employee has 'EPF No :' (empty entry) -> Permanent Staff, epfNumber undefined
    const basnayaka = records.find((r) => /basnayaka/i.test(r.employeeName ?? ""));
    expect(basnayaka).toBeDefined();
    expect(basnayaka?.staffCategory).toBe("permanent");
    expect(basnayaka?.epfNumber).toBeUndefined();
    expect(basnayaka?.employeeEmail).toBe("harshanimeda@gmail.com");

    // 2. Other employees have 'Contract Basis' -> Contract Staff, epfNumber undefined
    const contractStaff = records.filter((r) => !/basnayaka/i.test(r.employeeName ?? ""));
    expect(contractStaff.length).toBe(4);
    for (const emp of contractStaff) {
      expect(emp.staffCategory).toBe("contract");
      expect(emp.epfNumber).toBeUndefined();
      // Email is displayed/extracted for all employees
      expect(emp.employeeEmail).toBe("harshanimeda@gmail.com");
    }
  });

  it("extracts numeric only for EPF No when entry is provided, and marks as Permanent Staff", () => {
    const customPayslip: SamplePayslipInput = {
      sheetName: "Custom Perm",
      employeeName: "Alice Perm",
      designation: "Developer",
      epfNumber: "EPF-9876",
      payrollMonth: "July 2022",
      basicSalary: 60000,
      grossSalary: 60000,
      totalDeductions: 5000,
      netSalary: 55000,
    };
    const buffer = buildPayrollWorkbookBuffer([customPayslip]);
    const records = parsePayrollWorkbook(buffer);

    expect(records.length).toBe(1);
    expect(records[0].staffCategory).toBe("permanent");
    // "Save only the number under the epf_number column"
    expect(records[0].epfNumber).toBe("9876");
  });

  it("builds preview assigning sequential PS-xxxx and CS-xxxx identifiers and shows emails for all employees", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const db = createMemoryDb();
    const supabase = createMemorySupabase(db);

    const previewResult = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "July 2022-Datafield Ssalary-NOW.xlsx"
    );

    expect(previewResult.success).toBe(true);
    if (!previewResult.success) return;

    const rows = previewResult.data.rows;
    expect(rows).toHaveLength(5);

    // Email displayed for all employees (not just the first)
    for (const row of rows) {
      expect(row.email).toBe("harshanimeda@gmail.com");
    }

    // First employee is Permanent Staff -> PS-0001, epfNumber is blank
    expect(rows[0].employeeName).toContain("Basnayaka");
    expect(rows[0].employeeNumber).toBe("PS-0001");
    expect(rows[0].epfNumber).toBe("");

    // Next employees are Contract Basis Staff -> CS-0001, CS-0002, CS-0003, CS-0004
    expect(rows[1].employeeName).toContain("Athauda");
    expect(rows[1].employeeNumber).toBe("CS-0001");
    expect(rows[1].epfNumber).toBe("");

    expect(rows[2].employeeName).toContain("Rajapaksha");
    expect(rows[2].employeeNumber).toBe("CS-0002");
    expect(rows[2].epfNumber).toBe("");

    expect(rows[3].employeeName).toContain("Dissanayaka");
    expect(rows[3].employeeNumber).toBe("CS-0003");
    expect(rows[3].epfNumber).toBe("");

    expect(rows[4].employeeName).toContain("Haflal");
    expect(rows[4].employeeNumber).toBe("CS-0004");
    expect(rows[4].epfNumber).toBe("");
  });

  it("increments sequential identifiers based on existing records in employees table", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const db = createMemoryDb({
      employees: [
        {
          id: "emp-ps-1",
          employee_number: "PS-0003",
          full_name: "Pre-existing Perm",
          email: "perm@example.com",
          designation: "Lead",
          epf_number: "1111",
          status: "active",
        },
        {
          id: "emp-cs-1",
          employee_number: "CS-0005",
          full_name: "Pre-existing Contract",
          email: "contract@example.com",
          designation: "Consultant",
          epf_number: null,
          status: "active",
        },
      ],
    });
    const supabase = createMemorySupabase(db);

    const previewResult = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "July 2022-Datafield Ssalary-NOW.xlsx"
    );

    expect(previewResult.success).toBe(true);
    if (!previewResult.success) return;

    const rows = previewResult.data.rows;
    // Perm starts after PS-0003 -> PS-0004
    expect(rows[0].employeeNumber).toBe("PS-0004");
    // Contract starts after CS-0005 -> CS-0006, CS-0007, CS-0008, CS-0009
    expect(rows[1].employeeNumber).toBe("CS-0006");
    expect(rows[2].employeeNumber).toBe("CS-0007");
    expect(rows[3].employeeNumber).toBe("CS-0008");
    expect(rows[4].employeeNumber).toBe("CS-0009");
  });

  it("when saving an employee, checks employee_number and adds only if not existing; does not add duplicate", async () => {
    const buffer = fs.readFileSync(fixturePath);
    const db = createMemoryDb();
    const supabase = createMemorySupabase(db);

    // Initial import
    const preview = await PayrollImportService.buildPreview(
      supabase as never,
      buffer,
      "July 2022-Datafield Ssalary-NOW.xlsx"
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

    const confirm1 = await PayrollImportService.confirmImport(supabase as never, {
      buffer,
      sourceFilename: "July 2022-Datafield Ssalary-NOW.xlsx",
      corrections,
    });

    expect(confirm1.success).toBe(true);
    if (!confirm1.success) return;

    expect(db.employees).toHaveLength(5);
    const basnayaka = db.employees.find((e) => e.employee_number === "PS-0001");
    expect(basnayaka).toBeDefined();
    expect(basnayaka?.epf_number).toBeNull();

    const cs1 = db.employees.find((e) => e.employee_number === "CS-0001");
    expect(cs1).toBeDefined();
    expect(cs1?.epf_number).toBeNull();

    // Now re-run import: existing employees must not be added as new employees
    const confirm2 = await PayrollImportService.confirmImport(supabase as never, {
      buffer,
      sourceFilename: "July 2022-Datafield Ssalary-NOW.xlsx",
      corrections,
    });

    expect(confirm2.success).toBe(true);
    // Still exactly 5 employees in master employees table
    expect(db.employees).toHaveLength(5);
  });
});

