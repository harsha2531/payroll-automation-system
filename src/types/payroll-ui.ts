// src/types/payroll-ui.ts

/**
 * Types used by the frontend UI components for monthly payroll processing.
 * These are deliberately lightweight and independent of the server domain
 * models to avoid accidental mutation of persisted data.
 */
export type PayslipStatus = "pending" | "generated" | "emailed" | "failed";

export interface PayrollRow {
  /** Unique identifier of the employee */
  employeeId: string;
  /** Human readable name */
  employeeName: string;
  /** Employee number (identifier shown on payslips) */
  employeeNumber: string;
  /** Department, optional */
  department?: string | null;
  /** Designation / role, optional */
  designation?: string | null;
  /** Gross salary for the selected month */
  grossPay: number;
  /** Net salary after deductions */
  netPay: number;
  /** Current processing status of the payslip */
  payslipStatus: PayslipStatus;
  /** Signed URL to download the generated payslip (if available) */
  payslipUrl?: string | null;
  /** Optional error message when generation or email fails */
  errorMessage?: string | null;
  /** Optional payroll item ID in database */
  payrollItemId?: string | null;
  /** Optional payroll run ID in database */
  payrollRunId?: string | null;
  /** Optional employee email */
  employeeEmail?: string | null;
  /** Optional detailed PDF status */
  pdfStatus?: "pending" | "generated" | "failed";
  /** Optional detailed email delivery status */
  emailStatus?: "pending" | "sent" | "failed";
  // Additional fields derived from database JSON columns
  /** Basic salary (may be duplicated from grossPay) */
  basicSalary?: number;
  /** Allowances total (legacy field) */
  allowances?: number;
  /** Total deductions (legacy) */
  totalDeduction?: number;
  /** Employer EPF contribution (12%) */
  epfEmployer?: number;
  /** Employer ETF contribution (3%) */
  etfEmployer?: number;
  /** Full earnings breakdown JSON */
  earnings_breakdown?: Record<string, any>;
  /** Full deductions breakdown JSON */
  deductions_breakdown?: Record<string, any>;

}
