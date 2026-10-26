import type { ValidationIssue } from "@/services/payroll-parser";

export type ImportDisposition =
  | "import_new_employee"
  | "import_existing_employee"
  | "fill_missing_employee_fields"
  | "skip_duplicate_period"
  | "reject";

export interface ImportAmounts {
  basicSalary: number;
  allowances: number;
  variablePayLabel: string | null;
  variablePayAmount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerContributions: number;
}

export interface ImportPreviewRow {
  rowId: string;
  sourceSheetName: string;
  originalEmployeeName: string;
  employeeName: string;
  email: string;
  epfNumber: string;
  designation: string;
  employeeNumber: string;
  periodLabel: string;
  year: number | null;
  month: number | null;
  amounts: ImportAmounts;
  issues: ValidationIssue[];
  warnings: string[];
  disposition: ImportDisposition;
  included: boolean;
  applyEmployeeUpdates: boolean;
  existingEmployee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    email: string;
    epfNumber: string | null;
    designation: string | null;
  } | null;
  duplicatePeriod: boolean;
  identityMatch: "epf" | "employee_number" | "email" | "none";
}

export interface ImportPreview {
  sourceFilename: string;
  year: number | null;
  month: number | null;
  periodLabel: string | null;
  mixedPeriods: boolean;
  workbookErrors: string[];
  warnings: string[];
  rows: ImportPreviewRow[];
  counts: {
    importable: number;
    skipped: number;
    rejected: number;
    willUpdate: number;
  };
}

export interface ImportRowCorrection {
  rowId: string;
  sourceSheetName: string;
  originalEmployeeName: string;
  employeeName?: string;
  email?: string;
  epfNumber?: string;
  designation?: string;
  included: boolean;
  applyEmployeeUpdates?: boolean;
}

export interface ImportSummaryRow {
  rowId: string;
  employeeName: string;
  outcome: "imported" | "updated" | "skipped" | "failed";
  message: string;
}

export interface ImportSummary {
  payrollRunId: string | null;
  year: number | null;
  month: number | null;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ImportSummaryRow[];
  error?: string;
}
