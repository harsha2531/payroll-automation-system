// src/services/payroll-ui.service.ts

/**
 * Frontend service that communicates with backend API endpoints to support the
 * Monthly Payroll page. Thin wrappers around `fetch` returning data shaped by the
 * UI‑specific types defined in `payroll-ui.ts`.
 */
import { PayrollRow } from "@/types/payroll-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""; // empty => same origin

/** Fetch payroll rows for a given month/year. */
export async function fetchPayrollRows(year: number, month: number): Promise<PayrollRow[]> {
  const resp = await fetch(`${API_BASE}/api/payroll/monthly?year=${year}&month=${month}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to load payroll rows: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data as PayrollRow[];
}

/** Enqueue a payroll processing job for the selected period. */
export async function startPayrollProcessing(year: number, month: number): Promise<{ jobId: string }> {
  const resp = await fetch(`${API_BASE}/api/payroll/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to start payroll processing: ${resp.status} ${err}`);
  }
  return (await resp.json()) as { jobId: string };
}

/** Retry PDF generation for a specific payroll item. */
export async function retryPdfGeneration(payrollItemId: string, year: number, month: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/payroll/${payrollItemId}/retry-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Retry PDF failed: ${resp.status} ${err}`);
  }
}

/** Retry email delivery for a specific payroll item. */
export async function retryEmailDelivery(payrollItemId: string, year: number, month: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/payroll/${payrollItemId}/retry-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Retry email failed: ${resp.status} ${err}`);
  }
}
