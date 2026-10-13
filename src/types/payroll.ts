/**
 * Payroll Domain Model Types
 * Phase 3.1 — Database Schema and Migrations
 */

export type EmployeeStatus = "active" | "inactive" | "terminated" | "on_leave";

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  status: EmployeeStatus;
  hireDate: string | null;
  terminationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollRunStatus =
  | "draft"
  | "processing"
  | "calculated"
  | "approved"
  | "completed"
  | "failed"
  | "cancelled";

export type PayrollRunType = "regular" | "supplementary" | "correction" | "bonus";

export interface PayrollRun {
  id: string;
  year: number;
  month: number;
  sequenceNumber: number;
  runType: PayrollRunType;
  status: PayrollRunStatus;
  createdBy: string | null;
  approvedBy: string | null;
  sourceFilename: string | null;
  importMetadata: Record<string, unknown>;
  totalEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  notes: string | null;
  errorMessage: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeNumberSnapshot: string;
  employeeNameSnapshot: string;
  employeeEmailSnapshot: string;
  designationSnapshot: string | null;
  departmentSnapshot: string | null;
  basicSalary: number;
  variablePayLabel: string | null;
  variablePayAmount: number;
  allowances: number;
  grossPay: number;
  totalDeductions: number;
  employerContributions: number;
  netPay: number;
  earningsBreakdown: Record<string, unknown>;
  deductionsBreakdown: Record<string, unknown>;
  calculationMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PayslipDocumentStatus = "pending" | "generated" | "failed";

export interface PayslipDocument {
  id: string;
  payrollItemId: string;
  payrollRunId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number | null;
  fileHash: string | null;
  mimeType: string;
  status: PayslipDocumentStatus;
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmailDeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced";

export interface EmailDelivery {
  id: string;
  payrollItemId: string;
  payslipDocumentId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  deliveryStatus: EmailDeliveryStatus;
  provider: string;
  providerMessageId: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  errorDetails: Record<string, unknown>;
  idempotencyKey: string;
  sentAt: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProcessingJobType =
  | "payroll_import"
  | "payroll_calculation"
  | "payslip_pdf_generation"
  | "email_dispatch"
  | "bulk_email_dispatch";

export type ProcessingJobStatus =
  | "queued"
  | "claimed"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ProcessingJob {
  id: string;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  errorMessage: string | null;
  errorDetails: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  claimedAt: string | null;
  claimedBy: string | null;
  lockedUntil: string | null;
  idempotencyKey: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
