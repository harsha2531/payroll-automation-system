// src/lib/payrollDataStore.ts
// In‑memory mock data store for monthly payroll rows and processing jobs.
// Replace with real DB access (e.g., Prisma) in production.

import { PayrollRow } from "@/types/payroll-ui";
import { generatePayslipPdf } from "./payrollPdfService";
import { sendPayslipEmail } from "./brevoEmailService";

type YearMonthKey = `${number}-${number}`; // "2024-5"

// Sample data for demonstration – mirrors the placeholder used in the UI.
const sampleData: Record<YearMonthKey, PayrollRow[]> = {
  "2024-5": [
    {
      employeeId: "e1",
      employeeName: "Alice Johnson",
      employeeNumber: "001",
      department: "Finance",
      designation: "Accountant",
      grossPay: 5000,
      netPay: 4200,
      payslipStatus: "pending",
    },
    {
      employeeId: "e2",
      employeeName: "Bob Smith",
      employeeNumber: "002",
      department: "HR",
      designation: "Recruiter",
      grossPay: 4800,
      netPay: 4100,
      payslipStatus: "generated",
      payslipUrl: "https://example.com/payslip/bob.pdf",
    },
  ],
};

/** Get payroll rows for the given year/month. */
export function getPayrollRows(year: number, month: number): PayrollRow[] {
  const key = `${year}-${month}` as YearMonthKey;
  // Return a deep copy to avoid accidental mutation by callers.
  const rows = sampleData[key] ?? [];
  return rows.map((r) => ({ ...r }));
}

/** Replace the rows for a period – used after processing to persist changes. */
export function setPayrollRows(
  year: number,
  month: number,
  rows: PayrollRow[],
): void {
  const key = `${year}-${month}` as YearMonthKey;
  // Store a copy.
  sampleData[key] = rows.map((r) => ({ ...r }));
}

/** Start a payroll processing job for a period.
 * Returns a job object that can be polled via getJobStatus.
 */
export function startProcessing(
  year: number,
  month: number,
): PayrollJob {
  const job = createJob();
  // Run the real payroll logic asynchronously.
  (async () => {
    try {
      const rows = getPayrollRows(year, month);
      // Process each row sequentially (could be parallel in production).
      for (const row of rows) {
        // Only process rows that have not been generated/emailed yet.
        if (row.payslipStatus === "pending" || row.payslipStatus === "failed") {
          try {
            // 1️⃣ Generate PDF and upload to Supabase.
            const pdfUrl = await generatePayslipPdf(row.employeeId, year, month);
            row.payslipUrl = pdfUrl;
            row.payslipStatus = "generated";
            // 2️⃣ Send email via Brevo.
            await sendPayslipEmail(row.employeeId, row.employeeName, row.employeeNumber, pdfUrl);
            row.payslipStatus = "emailed";
          } catch (e) {
            // Capture failure – keep status as failed and record error.
            row.payslipStatus = "failed";
            row.errorMessage = (e as Error).message;
          }
        }
      }
      // Persist updated rows.
      setPayrollRows(year, month, rows);
      // Mark job as completed.
      const stored = getJob(job.jobId);
      if (stored) stored.status = "completed";
    } catch (e) {
      const stored = getJob(job.jobId);
      if (stored) {
        stored.status = "failed";
        stored.error = (e as Error).message;
      }
    }
  })();
  return job;
}

/** Retrieve status of a processing job. */
export function getJobStatus(jobId: string): PayrollJob | undefined {
  return getJob(jobId);
}

/** Retry PDF generation for a specific employee row (identified by employeeId).
 * For demo purposes we simply set the status to "generated" and assign a URL.
 */
export function retryPdf(employeeId: string, year: number, month: number): void {
  const rows = getPayrollRows(year, month);
  const updated = rows.map((row) =>
    row.employeeId === employeeId
      ? {
          ...row,
          payslipStatus: "generated",
          payslipUrl: `https://example.com/payslip/${employeeId}-${year}-${month}.pdf`,
        }
      : row,
  );
  setPayrollRows(year, month, updated);
}

/** Retry email delivery – simply mark status as "emailed" if a payslip exists. */
export function retryEmail(employeeId: string, year: number, month: number): void {
  const rows = getPayrollRows(year, month);
  const updated = rows.map((row) =>
    row.employeeId === employeeId && row.payslipUrl
      ? { ...row, payslipStatus: "emailed" }
      : row,
  );
  setPayrollRows(year, month, updated);
}

