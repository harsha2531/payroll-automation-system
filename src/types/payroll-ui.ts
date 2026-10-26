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
}
