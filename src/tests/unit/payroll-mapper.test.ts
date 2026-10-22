// src/tests/unit/payroll-mapper.test.ts
// Phase 6.1 — Unit Tests for Payroll Data Mapping and Preparation

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parsePayrollWorkbook,
  type PayrollRecord,
} from "@/services/payroll-parser";
import {
  mapPayrollRecordToItem,
  mapPayrollRecordsToRun,
  preparePayrollBatch,
  toPayrollItemInsert,
  toPayrollRunInsert,
  parsePayrollMonth,
} from "@/services/payroll-mapper";

describe("Phase 6.1: Payroll Data Mapping and Preparation", () => {
  // 1. Correct field mapping
  it("1. Maps Excel salary values to the correct output fields", () => {
    const record: PayrollRecord = {
      employeeName: "Jane Doe",
      designation: "Software Engineer",
      epfNumber: "EPF-123",
      employeeEmail: "jane.doe@example.com",
      payrollMonth: "July 2022",
      payslipDate: "2022-07-31",
      companyName: "Acme Corp",
      companyAddress: "123 Business Rd",
      companyEmail: "payroll@acmepayroll.local",
      sourceSheetName: "Jane Doe",
      basicSalary: 50000,
      allowances: 15000,
      allowancesBreakdown: {
        "Travelling Allowance": 10000,
        "Budgetary Allowance": 5000,
      },
      variablePayLabel: "Over Time",
      variablePay: 2500,
      grossSalary: 67500,
      deductionsBreakdown: {
        "EPF 8%": 4000,
        "Stamp Duty": 25,
      },
      totalDeductions: 4025,
      netSalary: 63475,
      employerEpf: 6000,
      employerEtf: 1500,
      employerContributions: 7500,
    };

    const item = mapPayrollRecordToItem(record);

    expect(item.employeeNameSnapshot).toBe("Jane Doe");
    expect(item.designationSnapshot).toBe("Software Engineer");
    expect(item.employeeNumberSnapshot).toBe("EPF-123");
    expect(item.employeeEmailSnapshot).toBe("jane.doe@example.com");
    expect(item.basicSalary).toBe(50000);
    expect(item.variablePayLabel).toBe("Over Time");
    expect(item.variablePayAmount).toBe(2500);
    expect(item.allowances).toBe(15000);
    expect(item.grossPay).toBe(67500);
    expect(item.totalDeductions).toBe(4025);
    expect(item.netPay).toBe(63475);
    expect(item.employerContributions).toBe(7500);

    expect(item.earningsBreakdown.allowances).toEqual({
      "Travelling Allowance": 10000,
      "Budgetary Allowance": 5000,
    });
    expect(item.calculationMetadata.companyName).toBe("Acme Corp");
    expect(item.calculationMetadata.payrollMonth).toBe("July 2022");
    expect(item.calculationMetadata.sourceSheetName).toBe("Jane Doe");
  });

  // 2. Gross salary remains exactly as extracted
  it("2. Preserves gross salary exactly as extracted without recalculation", () => {
    // Deliberate test: grossSalary from sheet is 80000, even if basic(50000) + allowances(20000) = 70000
    const record: PayrollRecord = {
      employeeName: "Bob Smith",
      payrollMonth: "July 2022",
      basicSalary: 50000,
      allowances: 20000,
      grossSalary: 80000, // Extracted value differs from sum of earnings
      netSalary: 75000,
    };

    const item = mapPayrollRecordToItem(record);
    // Must remain 80000, NOT recalculated to 70000!
    expect(item.grossPay).toBe(80000);
  });

  // 3. Total deductions and net salary remain exactly as extracted
  it("3. Preserves total deductions and net salary exactly as extracted", () => {
    // Deliberate test: Net salary on sheet is 72000, despite gross 80000 - deductions 5000 = 75000
    const record: PayrollRecord = {
      employeeName: "Alice Walker",
      payrollMonth: "July 2022",
      basicSalary: 60000,
      grossSalary: 80000,
      totalDeductions: 5000,
      netSalary: 72000, // Extracted value
    };

    const item = mapPayrollRecordToItem(record);
    expect(item.totalDeductions).toBe(5000);
    expect(item.netPay).toBe(72000); // Preserved exactly as extracted
  });

  // 4. Employee and employer contribution values remain separate
  it("4. Keeps employee deductions and employer contributions strictly separate", () => {
    const record: PayrollRecord = {
      employeeName: "Charlie",
      payrollMonth: "July 2022",
      basicSalary: 50000,
      grossSalary: 50000,
      deductionsBreakdown: {
        "EPF 8%": 4000,
        "Stamp Duty": 25,
      },
      totalDeductions: 4025, // Employee deduction
      netSalary: 45975,
      employerEpf: 6000, // Employer contribution
      employerEtf: 1500, // Employer contribution
      employerContributions: 7500,
    };

    const item = mapPayrollRecordToItem(record);

    // Employee total deductions does NOT include employer EPF/ETF
    expect(item.totalDeductions).toBe(4025);
    expect(item.deductionsBreakdown.employeeDeductions.total).toBe(4025);

    // Employer contributions are tracked separately
    expect(item.employerContributions).toBe(7500);
    expect(item.deductionsBreakdown.employerContributions.epf12).toBe(6000);
    expect(item.deductionsBreakdown.employerContributions.etf3).toBe(1500);
    expect(item.deductionsBreakdown.employerContributions.total).toBe(7500);
  });

  // 5. Decimal amounts and zero values are preserved
  it("5. Preserves decimal amounts and zero values without precision loss", () => {
    const record: PayrollRecord = {
      employeeName: "Decimal Worker",
      payrollMonth: "July 2022",
      basicSalary: 46500.55,
      allowances: 3500.25,
      variablePayLabel: "Over Time",
      variablePay: 0, // Zero value must be preserved as 0, not undefined
      grossSalary: 50000.8,
      totalDeductions: 0, // Zero deductions preserved
      netSalary: 50000.8,
      employerEpf: 6000.12,
      employerEtf: 1500.03,
      employerContributions: 7500.15,
    };

    const item = mapPayrollRecordToItem(record);

    expect(item.basicSalary).toBe(46500.55);
    expect(item.allowances).toBe(3500.25);
    expect(item.variablePayAmount).toBe(0);
    expect(item.grossPay).toBe(50000.8);
    expect(item.totalDeductions).toBe(0);
    expect(item.netPay).toBe(50000.8);
    expect(item.employerContributions).toBe(7500.15);
  });

  // 6. Missing and ambiguous values are handled safely
  it("6. Handles missing and ambiguous values safely without crashing or guessing", () => {
    const minimalRecord: PayrollRecord = {
      employeeName: "Minimal Worker",
      payrollMonth: "July 2022",
      basicSalary: 50000,
    };

    const item = mapPayrollRecordToItem(minimalRecord);

    expect(item.employeeNameSnapshot).toBe("Minimal Worker");
    expect(item.basicSalary).toBe(50000);
    expect(item.grossPay).toBe(50000);
    expect(item.allowances).toBe(0);
    expect(item.variablePayLabel).toBeNull();
    expect(item.variablePayAmount).toBe(0);
    expect(item.totalDeductions).toBe(0);
    expect(item.employerContributions).toBe(0);
    expect(item.netPay).toBe(50000);
  });

  // 7. Inconsistent totals are flagged without being corrected
  it("7. Flags inconsistent totals for review without modifying source values", () => {
    const inconsistentRecord: PayrollRecord = {
      employeeName: "Discrepancy Worker",
      payrollMonth: "July 2022",
      basicSalary: 50000,
      allowances: 10000,
      variablePay: 0,
      grossSalary: 70000, // 50k + 10k != 70k (mismatch)
      totalDeductions: 5000,
      netSalary: 60000, // 70k - 5k != 60k (mismatch)
    };

    const item = mapPayrollRecordToItem(inconsistentRecord);

    // Source values must NOT be modified
    expect(item.grossPay).toBe(70000);
    expect(item.netPay).toBe(60000);

    // Discrepancies must be flagged
    expect(item.calculationMetadata.isConsistent).toBe(false);
    expect(item.calculationMetadata.discrepancies.length).toBeGreaterThan(0);
    const msgs = item.calculationMetadata.discrepancies.join(" ");
    expect(msgs).toContain("Extracted Gross Salary");
    expect(msgs).toContain("Extracted Net Salary");
  });

  // 8. Different variable earnings labels are preserved
  it("8. Preserves different variable earnings labels verbatim", () => {
    const overtimeRecord: PayrollRecord = {
      employeeName: "OT Worker",
      payrollMonth: "July 2022",
      basicSalary: 40000,
      variablePayLabel: "Over Time",
      variablePay: 3500,
      grossSalary: 43500,
      netSalary: 43500,
    };

    const bonusRecord: PayrollRecord = {
      employeeName: "Bonus Worker",
      payrollMonth: "July 2022",
      basicSalary: 70000,
      variablePayLabel: "Performance Bonus",
      variablePay: 15000,
      grossSalary: 85000,
      netSalary: 85000,
    };

    const otItem = mapPayrollRecordToItem(overtimeRecord);
    const bonusItem = mapPayrollRecordToItem(bonusRecord);

    expect(otItem.variablePayLabel).toBe("Over Time");
    expect(otItem.variablePayAmount).toBe(3500);

    expect(bonusItem.variablePayLabel).toBe("Performance Bonus");
    expect(bonusItem.variablePayAmount).toBe(15000);
  });

  // 9. Repeated mapping produces consistent, idempotent output
  it("9. Repeated mapping of the same input produces consistent deterministic output", () => {
    const record: PayrollRecord = {
      employeeName: "Deterministic Worker",
      payrollMonth: "July 2022",
      basicSalary: 50000,
      grossSalary: 50000,
      netSalary: 50000,
    };

    const item1 = mapPayrollRecordToItem(record);
    const item2 = mapPayrollRecordToItem(record);

    expect(item1.basicSalary).toBe(item2.basicSalary);
    expect(item1.grossPay).toBe(item2.grossPay);
    expect(item1.totalDeductions).toBe(item2.totalDeductions);
    expect(item1.netPay).toBe(item2.netPay);
    expect(item1.employeeNumberSnapshot).toBe(item2.employeeNumberSnapshot);
  });

  // 10. No payroll calculations are performed
  it("10. Does not perform salary calculations, taxes, or formula overrides", () => {
    const unusualTaxesRecord: PayrollRecord = {
      employeeName: "Special Rules Worker",
      payrollMonth: "July 2022",
      basicSalary: 100000,
      grossSalary: 100000,
      totalDeductions: 1234.56, // Non-standard deduction rate
      netSalary: 98765.44,
      employerEpf: 999.99, // Non-standard employer EPF
      employerEtf: 111.11,
      employerContributions: 1111.1,
    };

    const item = mapPayrollRecordToItem(unusualTaxesRecord);

    // Backend didn't overwrite EPF with 8% (8000) or 12% (12000)
    expect(item.totalDeductions).toBe(1234.56);
    expect(item.netPay).toBe(98765.44);
    expect(item.employerContributions).toBe(1111.1);
  });

  // 11. Batch preparation and header generation
  it("11. Prepares a batch of records and aggregates the PayrollRun header correctly", () => {
    const records: PayrollRecord[] = [
      {
        employeeName: "Worker A",
        payrollMonth: "July 2022",
        basicSalary: 50000,
        grossSalary: 50000,
        totalDeductions: 4000,
        netSalary: 46000,
        employerContributions: 7500,
      },
      {
        employeeName: "Worker B",
        payrollMonth: "July 2022",
        basicSalary: 70000,
        grossSalary: 75000,
        totalDeductions: 5000,
        netSalary: 70000,
        employerContributions: 10500,
      },
    ];

    const batch = preparePayrollBatch(records, {
      runOptions: { sourceFilename: "July2022.xlsx" },
    });

    expect(batch.run.year).toBe(2022);
    expect(batch.run.month).toBe(7);
    expect(batch.run.totalEmployees).toBe(2);
    expect(batch.run.totalGrossPay).toBe(125000);
    expect(batch.run.totalDeductions).toBe(9000);
    expect(batch.run.totalNetPay).toBe(116000);
    expect(batch.run.totalEmployerContributions).toBe(18000);
    expect(batch.items).toHaveLength(2);
  });

  // 12. Database row conversion produces valid schema payloads
  it("12. Converts prepared records to database row insert types", () => {
    const record: PayrollRecord = {
      employeeName: "Insert Test",
      payrollMonth: "July 2022",
      basicSalary: 50000,
      grossSalary: 50000,
      netSalary: 50000,
    };

    const item = mapPayrollRecordToItem(record);
    const run = mapPayrollRecordsToRun([record]);

    const runInsert = toPayrollRunInsert(run, {
      id: "run-uuid-1",
      created_by: "user-uuid-1",
    });
    const itemInsert = toPayrollItemInsert(item, "run-uuid-1", "emp-uuid-1");

    expect(runInsert.year).toBe(2022);
    expect(runInsert.month).toBe(7);
    expect(runInsert.total_gross_pay).toBe(50000);

    expect(itemInsert.payroll_run_id).toBe("run-uuid-1");
    expect(itemInsert.employee_id).toBe("emp-uuid-1");
    expect(itemInsert.employee_name_snapshot).toBe("Insert Test");
    expect(itemInsert.gross_pay).toBe(50000);
    expect(itemInsert.net_pay).toBe(50000);
  });

  // 13. End-to-end mapping from the sanitized sample fixture workbook
  it("13. Extracts and maps records from the actual sample fixture workbook", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../tests/fixtures/July 2022-Datafield Ssalary-NOW.xlsx"
    );
    expect(fs.existsSync(fixturePath)).toBe(true);

    const buffer = fs.readFileSync(fixturePath);
    const records = parsePayrollWorkbook(buffer);

    expect(records.length).toBeGreaterThanOrEqual(4);

    const batch = preparePayrollBatch(records, {
      runOptions: { sourceFilename: "July 2022-Datafield Ssalary-NOW.xlsx" },
    });

    expect(batch.run.year).toBe(2022);
    expect(batch.run.month).toBe(7);
    expect(batch.run.totalEmployees).toBeGreaterThanOrEqual(4);

    // Verify first employee (Basnayaka)
    const basnayaka = batch.items.find((i) =>
      /basnayaka/i.test(i.employeeNameSnapshot)
    );
    expect(basnayaka).toBeDefined();
    if (basnayaka) {
      expect(basnayaka.basicSalary).toBe(46500);
      expect(basnayaka.grossPay).toBe(85000);
      expect(basnayaka.totalDeductions).toBe(4025);
      expect(basnayaka.netPay).toBe(80975);
      expect(basnayaka.employerContributions).toBe(7500);
      expect(basnayaka.calculationMetadata.companyName).toContain(
        "STARTUP SOLUTIONS"
      );
      expect(basnayaka.calculationMetadata.isConsistent).toBe(true);
    }
  });

  // 14. Month string parsing test
  it("14. Correctly parses various payroll month formats", () => {
    expect(parsePayrollMonth("July - 2022")).toEqual({ year: 2022, month: 7 });
    expect(parsePayrollMonth("July 2022")).toEqual({ year: 2022, month: 7 });
    expect(parsePayrollMonth("MONTH OF JUNE - 2022")).toEqual({
      year: 2022,
      month: 6,
    });
    expect(parsePayrollMonth("2023-11")).toEqual({ year: 2023, month: 11 });
    expect(parsePayrollMonth("2024/02")).toEqual({ year: 2024, month: 2 });
    expect(parsePayrollMonth("invalid")).toBeNull();
    expect(parsePayrollMonth(undefined)).toBeNull();
  });
});

