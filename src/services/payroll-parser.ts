// src/services/payroll-parser.ts
// Simple server‑side Excel payroll parser – Phase 5.1
// Uses SheetJS (xlsx) to read .xlsx buffers and extracts payroll rows.

import type { WorkBook, WorkSheet } from "xlsx";
import * as XLSX from "xlsx";

/**
 * Basic payroll fields we try to extract from each employee worksheet.
 * Not all fields are guaranteed to exist – callers must handle undefined.
 */
export interface PayrollRecord {
  /** Name of the employee (as appears on the sheet) */
  employeeName?: string;
  /** Designation / job title */
  designation?: string;
  /** EPF number if present */
  epfNumber?: string;
  /** Payroll month (e.g. "July 2022") */
  payrollMonth?: string;
  /** Basic salary amount */
  basicSalary?: number;
  /** Variable earnings – label is kept verbatim (e.g. "Over Time") */
  variablePayLabel?: string;
  /** Variable earnings amount */
  variablePay?: number;
  /** Deductions – label is kept verbatim (e.g. "EPF") */
  deductionLabel?: string;
  /** Deductions amount */
  deduction?: number;
  /** Net salary amount */
  netSalary?: number;
}

/**
 * Helper to safely parse a numeric cell – returns undefined if the value
 * cannot be reasonably interpreted as a number.
 */
function tryParseNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Main entry point – receives an XLSX buffer (e.g. from a file upload) and
 * returns an array of payroll records, one per non‑empty worksheet.
 */
export function parsePayrollWorkbook(buffer: Buffer): PayrollRecord[] {
  const wb: WorkBook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const records: PayrollRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws: WorkSheet = wb.Sheets[sheetName];
    // Convert the sheet to a 2‑dimensional array (rows × columns).
    const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false });
    if (!raw || raw.length === 0) continue; // skip empty sheet

    // Heuristic: the first non‑empty row that contains a string that looks like a name
    // is used as the employee identifier. Most of the sample workbooks have the
    // employee name in the first column of the first data row.
    const firstRow = raw[0] as (string | undefined)[];
    const employeeName = firstRow.find((cell) => typeof cell === "string" && cell.trim().length > 0) as string | undefined;

    // Walk the sheet rows looking for known labels. The exact layout of the
    // Numbers‑exported workbook varies, so we do not assume fixed column indexes.
    let designation: string | undefined;
    let epfNumber: string | undefined;
    let payrollMonth: string | undefined;
    let basicSalary: number | undefined;
    let variablePayLabel: string | undefined;
    let variablePay: number | undefined;
    let deductionLabel: string | undefined;
    let deduction: number | undefined;
    let netSalary: number | undefined;

    for (const row of raw) {
      const cells = row as (string | number | undefined)[];
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (typeof cell !== "string") continue;
        const txt = cell.trim();
        // Simple case‑insensitive matching of common payroll labels.
        if (/designation/i.test(txt) && i + 1 < cells.length) {
          designation = String(cells[i + 1]).trim();
        } else if (/epf\s*no\.?/i.test(txt) && i + 1 < cells.length) {
          epfNumber = String(cells[i + 1]).trim();
        } else if (/month|payroll\s*month/i.test(txt) && i + 1 < cells.length) {
          payrollMonth = String(cells[i + 1]).trim();
        } else if (/basic\s*salary/i.test(txt) && i + 1 < cells.length) {
          basicSalary = tryParseNumber(cells[i + 1]);
        } else if (/net\s*salary/i.test(txt) && i + 1 < cells.length) {
          netSalary = tryParseNumber(cells[i + 1]);
        } else if (/earnings|variable|bonus|overtime/i.test(txt) && i + 1 < cells.length) {
          variablePayLabel = txt; // keep the original label
          variablePay = tryParseNumber(cells[i + 1]);
        } else if (/deduction|tax|epf|stamp\s*duty/i.test(txt) && i + 1 < cells.length) {
          deductionLabel = txt; // original label
          deduction = tryParseNumber(cells[i + 1]);
        }
      }
    }

    const record: PayrollRecord = {
      employeeName,
      designation,
      epfNumber,
      payrollMonth,
      basicSalary,
      variablePayLabel,
      variablePay,
      deductionLabel,
      deduction,
      netSalary,
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
    employeeName: trim(rec.employeeName),
    designation: trim(rec.designation),
    epfNumber: trim(rec.epfNumber),
    payrollMonth: trim(rec.payrollMonth),
    basicSalary: rec.basicSalary,
    variablePayLabel: trim(rec.variablePayLabel),
    variablePay: rec.variablePay,
    deductionLabel: trim(rec.deductionLabel),
    deduction: rec.deduction,
    netSalary: rec.netSalary,
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

  const numericFields: (keyof PayrollRecord)[] = ["variablePay", "deduction", "netSalary"];
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

/**
 * Exported for convenience – used by API routes or other server‑side code.
 */
export default { parsePayrollWorkbook };
