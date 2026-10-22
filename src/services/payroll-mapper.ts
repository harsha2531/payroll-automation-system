// src/services/payroll-mapper.ts
// Phase 6.1 — Payroll Data Mapping and Preparation Service
// Maps extracted Excel payroll records into structured database entities
// without performing any recalculation of source salary values.

import type { PayrollRecord } from "./payroll-parser";
import type { Database } from "@/types/database.types";

export type PayrollItemInsert = Database["public"]["Tables"]["payroll_items"]["Insert"];
export type PayrollRunInsert = Database["public"]["Tables"]["payroll_runs"]["Insert"];

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Safely parses human-readable month strings into year and month numbers.
 * Supports: "July - 2022", "July 2022", "2022-07", "MONTH OF JUNE - 2022", etc.
 */
export function parsePayrollMonth(monthStr?: string): { year: number; month: number } | null {
  if (!monthStr || typeof monthStr !== "string") return null;
  const clean = monthStr.trim();
  if (!clean) return null;

  // Format 1: "2022-07" or "2022/07"
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  // Format 2: "July - 2022", "July 2022", "MONTH OF JUNE - 2022"
  const nameMatch = clean.match(/([A-Za-z]+)\s*(?:-|–|—|\/)?\s*(\d{4})/);
  if (nameMatch) {
    const name = nameMatch[1].toLowerCase();
    const year = parseInt(nameMatch[2], 10);
    const month = MONTH_NAMES[name];
    if (month && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  // Format 3: "2022 July"
  const yearFirstMatch = clean.match(/(\d{4})\s*(?:-|–|—|\/)?\s*([A-Za-z]+)/);
  if (yearFirstMatch) {
    const year = parseInt(yearFirstMatch[1], 10);
    const month = MONTH_NAMES[yearFirstMatch[2].toLowerCase()];
    if (month && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  return null;
}

export interface EmployeeMapping {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  designation?: string | null;
  department?: string | null;
}

export interface MapItemOptions {
  payrollRunId?: string;
  employeeId?: string;
  employeeMapping?: EmployeeMapping;
  fallbackEmployeeNumberPrefix?: string;
  itemIndex?: number;
}

export interface PreparedPayrollItem {
  payrollRunId?: string;
  employeeId?: string;
  employeeNumberSnapshot: string;
  employeeNameSnapshot: string;
  employeeEmailSnapshot: string;
  designationSnapshot: string | null;
  departmentSnapshot: string | null;

  // Monetary fields strictly matching source extracted amounts
  basicSalary: number;
  variablePayLabel: string | null;
  variablePayAmount: number;
  allowances: number;
  grossPay: number;
  totalDeductions: number;
  employerContributions: number;
  netPay: number;

  earningsBreakdown: {
    basicSalary: number;
    allowances: Record<string, number>;
    totalAllowances: number;
    variablePay?: {
      label: string;
      amount: number;
    };
    extractedGrossPay: number;
    [key: string]: unknown;
  };

  deductionsBreakdown: {
    employeeDeductions: Record<string, number> & {
      total?: number;
    };
    employerContributions: {
      epf12?: number;
      etf3?: number;
      total?: number;
    };
    [key: string]: unknown;
  };

  calculationMetadata: {
    companyName?: string;
    companyAddress?: string;
    companyEmail?: string;
    payrollMonth?: string;
    payrollPeriod?: { year: number; month: number };
    payslipDate?: string;
    sourceSheetName?: string;
    discrepancies: string[];
    isConsistent: boolean;
    extractedAt: string;
    [key: string]: unknown;
  };
}

export interface MapRunOptions {
  year?: number;
  month?: number;
  sourceFilename?: string;
  notes?: string;
  status?: Database["public"]["Tables"]["payroll_runs"]["Row"]["status"];
}

export interface PreparedPayrollRun {
  year: number;
  month: number;
  totalEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerContributions: number;
  sourceFilename?: string;
  notes?: string;
  importMetadata: {
    sourceSheets: string[];
    companyName?: string;
    companyAddress?: string;
    payrollMonth?: string;
    discrepancies: string[];
    importedAt: string;
    [key: string]: unknown;
  };
}

export interface PreparedPayrollBatch {
  run: PreparedPayrollRun;
  items: PreparedPayrollItem[];
  warnings: string[];
}

/**
 * Maps a single validated PayrollRecord from the parser into a PreparedPayrollItem.
 * Crucially, it does NOT recalculate gross, deductions, or net salary.
 */
export function mapPayrollRecordToItem(
  record: PayrollRecord,
  options: MapItemOptions = {}
): PreparedPayrollItem {
  const {
    payrollRunId,
    employeeId,
    employeeMapping,
    fallbackEmployeeNumberPrefix = "EMP",
    itemIndex = 1,
  } = options;

  const employeeName = (employeeMapping?.fullName || record.employeeName || "").trim();
  const designation = employeeMapping?.designation || record.designation || null;
  const department = employeeMapping?.department || null;

  // Snapshot employee number: from mapping, from epfNumber, or fallback
  const employeeNumber =
    employeeMapping?.employeeNumber ||
    record.epfNumber ||
    `${fallbackEmployeeNumberPrefix}-${String(itemIndex).padStart(3, "0")}`;

  // Snapshot email: from mapping, from record, company email, or placeholder
  const employeeEmail =
    employeeMapping?.email ||
    record.employeeEmail ||
    record.companyEmail ||
    `employee.${employeeNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@company.local`;

  // Explicit monetary amounts - STRICTLY AS EXTRACTED
  const basicSalary = record.basicSalary ?? 0;
  const variablePayLabel = record.variablePayLabel ?? null;
  const variablePayAmount = record.variablePay ?? 0;
  const allowances = record.allowances ?? 0;
  const grossPay = record.grossSalary ?? basicSalary;
  const totalDeductions = record.totalDeductions ?? record.deduction ?? 0;

  // Employer contributions: strictly separated from employee deductions
  let employerContributions = record.employerContributions;
  if (employerContributions === undefined) {
    if (record.employerEpf !== undefined || record.employerEtf !== undefined) {
      employerContributions = (record.employerEpf ?? 0) + (record.employerEtf ?? 0);
    } else {
      employerContributions = 0;
    }
  }

  const netPay = record.netSalary ?? (grossPay - totalDeductions);

  // Inconsistency detection (flagging discrepancies without altering extracted values)
  const discrepancies: string[] = [];

  const allowancesSum = Object.values(record.allowancesBreakdown ?? {}).reduce(
    (acc, v) => acc + (v ?? 0),
    0
  );
  const effectiveAllowances = record.allowancesBreakdown ? allowancesSum : allowances;
  const sumEarnings = basicSalary + variablePayAmount + effectiveAllowances;

  if (record.grossSalary !== undefined && Math.abs(record.grossSalary - sumEarnings) > 0.01) {
    discrepancies.push(
      `Discrepancy: Extracted Gross Salary (${record.grossSalary}) does not equal sum of basic (${basicSalary}), variable pay (${variablePayAmount}), and allowances (${effectiveAllowances}) = ${sumEarnings}. Extracted value preserved.`
    );
  }

  const deductionsSum = Object.values(record.deductionsBreakdown ?? {}).reduce(
    (acc, v) => acc + (v ?? 0),
    0
  );
  if (
    record.totalDeductions !== undefined &&
    deductionsSum > 0 &&
    Math.abs(record.totalDeductions - deductionsSum) > 0.01
  ) {
    discrepancies.push(
      `Discrepancy: Extracted Total Deductions (${record.totalDeductions}) does not equal sum of individual deductions (${deductionsSum}). Extracted value preserved.`
    );
  }

  if (
    record.grossSalary !== undefined &&
    record.totalDeductions !== undefined &&
    record.netSalary !== undefined
  ) {
    const expectedNet = record.grossSalary - record.totalDeductions;
    if (Math.abs(record.netSalary - expectedNet) > 0.01) {
      discrepancies.push(
        `Discrepancy: Extracted Net Salary (${record.netSalary}) does not equal Gross Salary (${record.grossSalary}) - Total Deductions (${record.totalDeductions}) = ${expectedNet}. Extracted value preserved.`
      );
    }
  }

  const period = parsePayrollMonth(record.payrollMonth);

  const earningsBreakdown = {
    basicSalary,
    allowances: record.allowancesBreakdown ?? {},
    totalAllowances: effectiveAllowances,
    variablePay: variablePayLabel
      ? {
          label: variablePayLabel,
          amount: variablePayAmount,
        }
      : undefined,
    extractedGrossPay: grossPay,
  };

  const deductionsBreakdown = {
    employeeDeductions: {
      ...(record.deductionsBreakdown ?? {}),
      total: totalDeductions,
    },
    employerContributions: {
      epf12: record.employerEpf,
      etf3: record.employerEtf,
      total: employerContributions,
    },
  };

  const calculationMetadata = {
    companyName: record.companyName,
    companyAddress: record.companyAddress,
    companyEmail: record.companyEmail,
    payrollMonth: record.payrollMonth,
    payrollPeriod: period ?? undefined,
    payslipDate: record.payslipDate,
    sourceSheetName: record.sourceSheetName,
    discrepancies,
    isConsistent: discrepancies.length === 0,
    extractedAt: new Date().toISOString(),
  };

  return {
    payrollRunId: payrollRunId || undefined,
    employeeId: employeeId || employeeMapping?.id || undefined,
    employeeNumberSnapshot: employeeNumber,
    employeeNameSnapshot: employeeName,
    employeeEmailSnapshot: employeeEmail,
    designationSnapshot: designation,
    departmentSnapshot: department,
    basicSalary,
    variablePayLabel,
    variablePayAmount,
    allowances: effectiveAllowances,
    grossPay,
    totalDeductions,
    employerContributions,
    netPay,
    earningsBreakdown,
    deductionsBreakdown,
    calculationMetadata,
  };
}

/**
 * Aggregates a batch of payroll records into a PreparedPayrollRun header.
 */
export function mapPayrollRecordsToRun(
  records: PayrollRecord[],
  options: MapRunOptions = {}
): PreparedPayrollRun {
  const firstRecord = records[0];
  const parsedPeriod = parsePayrollMonth(firstRecord?.payrollMonth);

  const now = new Date();
  const year = options.year ?? parsedPeriod?.year ?? now.getFullYear();
  const month = options.month ?? parsedPeriod?.month ?? now.getMonth() + 1;

  let totalGrossPay = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;
  let totalEmployerContributions = 0;
  const sourceSheets: string[] = [];
  const runDiscrepancies: string[] = [];

  for (const rec of records) {
    if (rec.sourceSheetName) {
      sourceSheets.push(rec.sourceSheetName);
    }
    const gross = rec.grossSalary ?? rec.basicSalary ?? 0;
    const deductions = rec.totalDeductions ?? rec.deduction ?? 0;
    const net = rec.netSalary ?? (gross - deductions);
    let employer = rec.employerContributions;
    if (employer === undefined && (rec.employerEpf !== undefined || rec.employerEtf !== undefined)) {
      employer = (rec.employerEpf ?? 0) + (rec.employerEtf ?? 0);
    }

    totalGrossPay += gross;
    totalDeductions += deductions;
    totalNetPay += net;
    totalEmployerContributions += employer ?? 0;
  }

  // Round summary sums to 2 decimal places to avoid standard JS float accumulation drift
  totalGrossPay = Math.round(totalGrossPay * 100) / 100;
  totalDeductions = Math.round(totalDeductions * 100) / 100;
  totalNetPay = Math.round(totalNetPay * 100) / 100;
  totalEmployerContributions = Math.round(totalEmployerContributions * 100) / 100;

  return {
    year,
    month,
    totalEmployees: records.length,
    totalGrossPay,
    totalDeductions,
    totalNetPay,
    totalEmployerContributions,
    sourceFilename: options.sourceFilename,
    notes: options.notes,
    importMetadata: {
      sourceSheets,
      companyName: firstRecord?.companyName,
      companyAddress: firstRecord?.companyAddress,
      payrollMonth: firstRecord?.payrollMonth,
      discrepancies: runDiscrepancies,
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Prepares an entire batch of records: generates run header, individual items, and compiles warnings.
 */
export function preparePayrollBatch(
  records: PayrollRecord[],
  options: {
    runOptions?: MapRunOptions;
    employeeLookup?: Record<string, EmployeeMapping>;
  } = {}
): PreparedPayrollBatch {
  const run = mapPayrollRecordsToRun(records, options.runOptions);
  const items: PreparedPayrollItem[] = [];
  const warnings: string[] = [];

  records.forEach((record, idx) => {
    const key = record.epfNumber || record.employeeName || "";
    const mapping = options.employeeLookup ? options.employeeLookup[key] : undefined;

    const item = mapPayrollRecordToItem(record, {
      employeeMapping: mapping,
      itemIndex: idx + 1,
    });

    items.push(item);

    if (item.calculationMetadata.discrepancies.length > 0) {
      warnings.push(
        `Item ${item.employeeNameSnapshot || idx + 1}: ${item.calculationMetadata.discrepancies.join("; ")}`
      );
    }
  });

  return { run, items, warnings };
}

/**
 * Converts a PreparedPayrollItem into an exact database insert row for public.payroll_items.
 */
export function toPayrollItemInsert(
  item: PreparedPayrollItem,
  payrollRunId: string,
  employeeId: string
): PayrollItemInsert {
  return {
    payroll_run_id: payrollRunId,
    employee_id: employeeId,
    employee_number_snapshot: item.employeeNumberSnapshot,
    employee_name_snapshot: item.employeeNameSnapshot,
    employee_email_snapshot: item.employeeEmailSnapshot,
    designation_snapshot: item.designationSnapshot,
    department_snapshot: item.departmentSnapshot,
    basic_salary: item.basicSalary,
    variable_pay_label: item.variablePayLabel,
    variable_pay_amount: item.variablePayAmount,
    allowances: item.allowances,
    gross_pay: item.grossPay,
    total_deductions: item.totalDeductions,
    employer_contributions: item.employerContributions,
    net_pay: item.netPay,
    earnings_breakdown: item.earningsBreakdown as unknown as Database["public"]["Tables"]["payroll_items"]["Insert"]["earnings_breakdown"],
    deductions_breakdown: item.deductionsBreakdown as unknown as Database["public"]["Tables"]["payroll_items"]["Insert"]["deductions_breakdown"],
    calculation_metadata: item.calculationMetadata as unknown as Database["public"]["Tables"]["payroll_items"]["Insert"]["calculation_metadata"],
  };
}

/**
 * Converts a PreparedPayrollRun into an exact database insert row for public.payroll_runs.
 */
export function toPayrollRunInsert(
  run: PreparedPayrollRun,
  extra: Partial<PayrollRunInsert> = {}
): PayrollRunInsert {
  return {
    year: run.year,
    month: run.month,
    sequence_number: extra.sequence_number ?? 1,
    run_type: extra.run_type ?? "regular",
    status: extra.status ?? "draft",
    source_filename: run.sourceFilename ?? null,
    total_employees: run.totalEmployees,
    total_gross_pay: run.totalGrossPay,
    total_deductions: run.totalDeductions,
    total_net_pay: run.totalNetPay,
    notes: run.notes ?? null,
    import_metadata: run.importMetadata as unknown as Database["public"]["Tables"]["payroll_runs"]["Insert"]["import_metadata"],
    ...extra,
  };
}

