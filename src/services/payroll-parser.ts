// src/services/payroll-parser.ts
// Simple server‑side Excel payroll parser – Phase 5.1
// Uses SheetJS (xlsx) to read .xlsx buffers and extracts payroll rows.

import type { WorkBook, WorkSheet } from "xlsx";
import * as XLSX from "xlsx";

/**
 * Basic payroll fields we extract from each employee worksheet.
 * Not all fields are guaranteed to exist – callers must handle undefined.
 */
export interface PayrollRecord {
  /** Name of the employee (as appears on the sheet) */
  employeeName?: string;
  /** Designation / job title */
  designation?: string;
  /** EPF number if present */
  epfNumber?: string;
  /** Employee email if available */
  employeeEmail?: string;
  /** Payroll month (e.g. "July 2022") */
  payrollMonth?: string;
  /** Payslip date if available */
  payslipDate?: string;
  /** Company name */
  companyName?: string;
  /** Company address */
  companyAddress?: string;
  /** Company email */
  companyEmail?: string;
  /** Source worksheet name */
  sourceSheetName?: string;

  /** Basic salary amount */
  basicSalary?: number;
  /** Extracted or summed allowances */
  allowances?: number;
  /** Breakdown of individual allowances */
  allowancesBreakdown?: Record<string, number>;
  /** Variable earnings – label is kept verbatim (e.g. "Over Time", "Bonus") */
  variablePayLabel?: string;
  /** Variable earnings amount */
  variablePay?: number;
  /** Extracted gross salary (source value preserved without recalculation) */
  grossSalary?: number;

  /** Deductions – label is kept verbatim (e.g. "EPF") */
  deductionLabel?: string;
  /** Deductions amount */
  deduction?: number;
  /** Individual employee deductions breakdown */
  deductionsBreakdown?: Record<string, number>;
  /** Extracted total employee deductions */
  totalDeductions?: number;

  /** Extracted net salary amount */
  netSalary?: number;

  /** Employer EPF contribution (e.g., 12%) */
  employerEpf?: number;
  /** Employer ETF contribution (e.g., 3%) */
  employerEtf?: number;
  /** Extracted or summed employer contributions */
  employerContributions?: number;

  /** Raw extracted values dictionary for auditing */
  rawValues?: Record<string, unknown>;
}

/**
 * Helper to safely parse a numeric cell – returns undefined if the value
 * cannot be reasonably interpreted as a number (e.g. empty, dash, text).
 * Preserves 0 as a valid numeric value.
 */
export function tryParseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "—") return undefined;
    const cleaned = trimmed.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-") return undefined;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Helper to find the next non-empty cell in a row starting after startIndex.
 */
function findNextValue(cells: (string | number | undefined)[], startIndex: number): unknown {
  for (let j = startIndex + 1; j < cells.length; j++) {
    const val = cells[j];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return val;
    }
  }
  return undefined;
}

/**
 * Main entry point – receives an XLSX buffer (e.g. from a file upload) and
 * returns an array of payroll records, one per employee worksheet.
 */
export function parsePayrollWorkbook(buffer: Buffer): PayrollRecord[] {
  if (!buffer || buffer.length === 0) return [];

  const wb: WorkBook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const records: PayrollRecord[] = [];

  // Determine if there are specific employee sheets alongside summary sheets
  const hasMultipleSheets = wb.SheetNames.length > 1;

  for (const sheetName of wb.SheetNames) {
    // If workbook has multiple sheets, skip summary/data field sheets in favor of individual payslips
    if (hasMultipleSheets && /summary|data\s*field|overview/i.test(sheetName)) {
      continue;
    }

    const ws: WorkSheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false });
    if (!raw || raw.length === 0) continue; // skip empty sheet

    let companyName: string | undefined;
    let companyAddress: string | undefined;
    let companyEmail: string | undefined;
    let employeeName: string | undefined;
    let designation: string | undefined;
    let epfNumber: string | undefined;
    let employeeEmail: string | undefined;
    let payrollMonth: string | undefined;
    let payslipDate: string | undefined;

    let basicSalary: number | undefined;
    const allowancesBreakdown: Record<string, number> = {};
    let variablePayLabel: string | undefined;
    let variablePay: number | undefined;
    let grossSalary: number | undefined;

    const deductionsBreakdown: Record<string, number> = {};
    let deductionLabel: string | undefined;
    let deduction: number | undefined;
    let totalDeductions: number | undefined;
    let netSalary: number | undefined;

    let employerEpf: number | undefined;
    let employerEtf: number | undefined;
    let employerContributions: number | undefined;
    const rawValues: Record<string, unknown> = {};

    // Inspect initial rows for company metadata
    for (let r = 0; r < Math.min(raw.length, 5); r++) {
      const rowCells = raw[r] as (string | undefined)[];
      for (const c of rowCells) {
        if (typeof c === "string") {
          const str = c.trim();
          if (/pvt\s*ltd|ltd\.?|limited|corp\.?|company/i.test(str) && !companyName) {
            companyName = str;
          } else if (/road|street|st\.|lane|nugegoda|colombo|no\.\s*\d+/i.test(str) && !companyAddress) {
            companyAddress = str;
          } else if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(str)) {
            if (!companyEmail) companyEmail = str;
          }
        }
      }
    }

    // Walk all rows looking for payroll details
    for (const row of raw) {
      const cells = row as (string | number | undefined)[];
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (typeof cell !== "string") continue;
        const txt = cell.trim();
        if (!txt) continue;

        // 1. Employee Name
        const nameMatch = txt.match(/^name\s*:\s*(.+)$/i);
        if (nameMatch) {
          employeeName = nameMatch[1].trim();
        } else if (/^(?:employee\s*)?name\b/i.test(txt) && !employeeName) {
          const next = findNextValue(cells, i);
          if (next !== undefined && typeof next === "string") {
            employeeName = next.trim();
          }
        }

        // 2. Designation
        const desigMatch = txt.match(/^designation\s*:\s*(.+)$/i);
        if (desigMatch) {
          designation = desigMatch[1].trim();
        } else if (/^designation\b/i.test(txt)) {
          const next = findNextValue(cells, i);
          if (next !== undefined) designation = String(next).trim();
        }

        // 3. EPF No
        const epfMatch = txt.match(/^epf\s*(?:no\.?|number)?\s*:\s*(.*)$/i);
        if (epfMatch) {
          const epfVal = epfMatch[1].trim();
          if (epfVal) epfNumber = epfVal;
        } else if (/^epf\s*(?:no\.?|number)\b/i.test(txt)) {
          const next = findNextValue(cells, i);
          if (next !== undefined && !/^\d+(?:\.\d+)?$/.test(String(next).trim())) {
            epfNumber = String(next).trim();
          }
        }

        // 4. Payroll Month
        const monthMatch = txt.match(/^(?:payroll\s*)?month\s*:\s*(.+)$/i);
        if (monthMatch) {
          payrollMonth = monthMatch[1].trim();
        } else if (/^(?:payroll\s*)?month\b/i.test(txt) && !payrollMonth) {
          const next = findNextValue(cells, i);
          if (next !== undefined) payrollMonth = String(next).trim();
        }

        // 5. Payslip Date
        const dateMatch = txt.match(/^(?:payslip\s*)?date\s*:\s*(.+)$/i);
        if (dateMatch) {
          payslipDate = dateMatch[1].trim();
        }

        // 6. Basic Salary
        if (/^basic\s*salary\b/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) basicSalary = parsed;
          rawValues["basicSalary"] = next;
        }

        // 7. Allowances (Budgetary, Travelling, Inflation, Additional, etc.)
        else if (
          /allowance|adjustment|travell?ing|inflation/i.test(txt) &&
          !/gross|net|deduction/i.test(txt)
        ) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) {
            allowancesBreakdown[txt] = parsed;
          }
          rawValues[txt] = next;
        }

        // 8. Variable Pay (Overtime, Bonus, Commission, Variable)
        else if (/earnings|variable|bonus|over\s*time|commission/i.test(txt) && !/gross/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          variablePayLabel = txt;
          if (parsed !== undefined) variablePay = parsed;
          rawValues[txt] = next;
        }

        // 9. Gross Salary
        else if (/gross\s*salary/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) grossSalary = parsed;
          rawValues["grossSalary"] = next;
        }

        // 10. Individual Deductions (EPF 8%, Stamp Duty, No Pay, Tax)
        else if (
          (/e\.?p\.?f\.?\s*8%/i.test(txt) ||
            /stamp\s*duty/i.test(txt) ||
            /no\s*pay/i.test(txt) ||
            /tax|paye|advance|loan/i.test(txt)) &&
          !/total\s*deduction/i.test(txt) &&
          !/12%|20%/i.test(txt)
        ) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) {
            deductionsBreakdown[txt] = parsed;
            if (!deductionLabel) {
              deductionLabel = txt;
              deduction = parsed;
            }
          }
          rawValues[txt] = next;
        }

        // 11. Total Deductions
        else if (/total\s*deductions?/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) totalDeductions = parsed;
          rawValues["totalDeductions"] = next;
        }

        // 12. Net Salary
        else if (/net\s*salary/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) netSalary = parsed;
          rawValues["netSalary"] = next;
        }

        // 13. Employer EPF 12%
        else if (/e\.?p\.?f\.?\s*12%/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) employerEpf = parsed;
          rawValues["employerEpf12"] = next;
        }

        // 14. Employer ETF 3%
        else if (/e\.?t\.?f\.?\s*3%/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) employerEtf = parsed;
          rawValues["employerEtf3"] = next;
        }

        // 15. Total Employer Contributions
        else if (/total\s*employer\s*contributions?/i.test(txt)) {
          const next = findNextValue(cells, i);
          const parsed = tryParseNumber(next);
          if (parsed !== undefined) employerContributions = parsed;
          rawValues["employerContributions"] = next;
        }
      }
    }

    // Fallbacks if not found via specific prefixes
    if (!employeeName) {
      // If sheetName doesn't look like a generic sheet, use it
      if (!/sheet|table|page/i.test(sheetName)) {
        employeeName = sheetName;
      } else {
        const firstRow = raw[0] as (string | undefined)[];
        employeeName = firstRow.find((cell) => typeof cell === "string" && cell.trim().length > 0);
      }
    }

    // Calculate total allowances if breakdown exists and explicit allowance wasn't given
    const allowancesValues = Object.values(allowancesBreakdown);
    const calculatedAllowances = allowancesValues.length > 0
      ? allowancesValues.reduce((acc, v) => acc + v, 0)
      : undefined;

    // Sum employer contributions if not explicitly given
    if (employerContributions === undefined && (employerEpf !== undefined || employerEtf !== undefined)) {
      employerContributions = (employerEpf ?? 0) + (employerEtf ?? 0);
    }

    const record: PayrollRecord = {
      employeeName,
      designation,
      epfNumber,
      employeeEmail,
      payrollMonth,
      payslipDate,
      companyName,
      companyAddress,
      companyEmail,
      sourceSheetName: sheetName,
      basicSalary,
      allowances: calculatedAllowances,
      allowancesBreakdown: Object.keys(allowancesBreakdown).length > 0 ? allowancesBreakdown : undefined,
      variablePayLabel,
      variablePay,
      grossSalary,
      deductionLabel,
      deduction: deduction ?? totalDeductions,
      deductionsBreakdown: Object.keys(deductionsBreakdown).length > 0 ? deductionsBreakdown : undefined,
      totalDeductions,
      netSalary,
      employerEpf,
      employerEtf,
      employerContributions,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    };

    records.push(record);
  }

  return records;
}

/** Types for validation */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: "error" | "warning";
  /** Field that triggered the issue */
  field: keyof PayrollRecord | string;
  /** Human‑readable message */
  message: string;
}

export interface ValidationResult {
  /** Normalized payroll record */
  record: PayrollRecord;
  /** List of validation issues (empty if none) */
  issues: ValidationIssue[];
}

/** Trim whitespace from all string fields and preserve numbers as‑is. */
export function normalizePayrollRecord(rec: PayrollRecord): PayrollRecord {
  const trim = (s?: string) => (s ? s.trim() : undefined);
  return {
    ...rec,
    employeeName: trim(rec.employeeName),
    designation: trim(rec.designation),
    epfNumber: trim(rec.epfNumber),
    employeeEmail: trim(rec.employeeEmail),
    payrollMonth: trim(rec.payrollMonth),
    payslipDate: trim(rec.payslipDate),
    companyName: trim(rec.companyName),
    companyAddress: trim(rec.companyAddress),
    companyEmail: trim(rec.companyEmail),
    sourceSheetName: trim(rec.sourceSheetName),
    variablePayLabel: trim(rec.variablePayLabel),
    deductionLabel: trim(rec.deductionLabel),
  };
}

/** Validate a payroll record. Returns a ValidationResult containing the normalized
 * record and any detected issues.
 */
export function validatePayrollRecord(rec: PayrollRecord): ValidationResult {
  const normalized = normalizePayrollRecord(rec);
  const issues: ValidationIssue[] = [];

  if (!normalized.employeeName) {
    issues.push({ severity: "error", field: "employeeName", message: "Employee name is missing" });
  }
  if (!normalized.payrollMonth) {
    issues.push({ severity: "error", field: "payrollMonth", message: "Payroll month is missing or unrecognised" });
  }
  if (normalized.basicSalary === undefined) {
    issues.push({ severity: "error", field: "basicSalary", message: "Basic salary is missing" });
  } else if (typeof normalized.basicSalary !== "number") {
    issues.push({ severity: "error", field: "basicSalary", message: "Basic salary is not a valid number" });
  }

  const numericFields: (keyof PayrollRecord)[] = [
    "variablePay",
    "deduction",
    "netSalary",
    "grossSalary",
    "totalDeductions",
    "employerContributions",
  ];
  for (const f of numericFields) {
    const v = normalized[f] as unknown;
    if (v !== undefined && typeof v !== "number") {
      issues.push({ severity: "error", field: f, message: `${f} is not a valid number` });
    }
    if (typeof v === "number" && v < 0) {
      issues.push({ severity: "warning", field: f, message: `${f} is negative – please review` });
    }
  }

  return { record: normalized, issues };
}

const payrollParser = { parsePayrollWorkbook, normalizePayrollRecord, validatePayrollRecord };
export default payrollParser;

