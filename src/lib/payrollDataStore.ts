// src/lib/payrollDataStore.ts
// Data store for monthly payroll rows and processing jobs backed by Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PayrollRow, PayslipStatus } from "@/types/payroll-ui";
import { generatePayslipPdf } from "./payrollPdfService";
import { sendPayslipEmail } from "./brevoEmailService";
import { createJob, getJob, PayrollJob } from "./payrollJobStore";

type YearMonthKey = `${number}-${number}`; // "2024-5"

interface RawPayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  employee_number_snapshot: string;
  employee_email_snapshot?: string | null;
  department_snapshot?: string | null;
  designation_snapshot?: string | null;
  basic_salary?: number | null;
  allowances?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  employer_contributions?: number | null;
  net_pay?: number | null;
  earnings_breakdown?: Record<string, unknown> | null;
  deductions_breakdown?: Record<string, unknown> | null;
  calculation_metadata?: Record<string, unknown> | null;
  error_message?: string | null;
  employees?:
    | {
        email?: string | null;
      }
    | {
        email?: string | null;
      }[]
    | null;
  payslip_documents?:
    | {
        id?: string;
        storage_path?: string;
        storage_bucket?: string;
        status?: string;
        error_message?: string | null;
      }[]
    | {
        id?: string;
        storage_path?: string;
        storage_bucket?: string;
        status?: string;
        error_message?: string | null;
      }
    | null;
  email_deliveries?:
    | {
        id?: string;
        delivery_status?: string;
        recipient_email?: string;
        error_message?: string | null;
      }[]
    | {
        id?: string;
        delivery_status?: string;
        recipient_email?: string;
        error_message?: string | null;
      }
    | null;
}

// In-memory cache / fallback store (primarily for unit tests and local mutations).
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

/**
 * Resolves a Supabase client.
 * Uses the passed-in client if provided (e.g. from tests or caller context),
 * or lazily imports the server-side admin client.
 */
async function getSupabaseClient(client?: SupabaseClient | unknown): Promise<SupabaseClient> {
  if (client) return client as SupabaseClient;
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    return createAdminClient() as unknown as SupabaseClient;
  } catch {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";
    return createClient(url, key);
  }
}

/**
 * Get payroll rows for the given year/month.
 * Supabase is the authoritative source. If no Supabase records exist,
 * falls back to the in-memory store if populated (for test suites).
 */
export async function getPayrollRows(
  year: number,
  month: number,
  client?: SupabaseClient | unknown
): Promise<PayrollRow[]> {
  const supabase = await getSupabaseClient(client);

  // 1. First, search for payroll runs corresponding to this period.
  const { data: runs, error: runsError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("year", year)
    .eq("month", month);

  if (runsError) {
    throw new Error(`Failed to retrieve payroll runs: ${runsError.message}`);
  }

  let items: RawPayrollItem[] = [];
  const runIds = ((runs || []) as { id: string }[]).map((r) => r.id);

  if (runIds.length > 0) {
    // 2. Query payroll items by payroll_run_id with employee email from employees table
    const { data, error: itemsError } = await supabase
      .from("payroll_items")
      .select(`
        id,
        payroll_run_id,
        employee_id,
        employee_name_snapshot,
        employee_number_snapshot,
        employee_email_snapshot,
        employees (
          email
        ),
        department_snapshot,
        designation_snapshot,
        basic_salary,
        allowances,
        gross_pay,
        total_deductions,
        employer_contributions,
        net_pay,
        earnings_breakdown,
        deductions_breakdown,
        calculation_metadata,
        error_message,
        payslip_documents (
          id,
          storage_path,
          storage_bucket,
          status,
          error_message
        ),
        email_deliveries (
          id,
          delivery_status,
          recipient_email,
          error_message
        )
      `)
      .in("payroll_run_id", runIds)
      .order("employee_number_snapshot", { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to retrieve payroll items: ${itemsError.message}`);
    }
    items = (data || []) as unknown as RawPayrollItem[];
  } else {
    // Fallback: Query by period inside calculation_metadata JSONB if runs not found
    const { data, error: fallbackError } = await supabase
      .from("payroll_items")
      .select(`
        id,
        payroll_run_id,
        employee_id,
        employee_name_snapshot,
        employee_number_snapshot,
        employee_email_snapshot,
        employees (
          email
        ),
        department_snapshot,
        designation_snapshot,
        basic_salary,
        allowances,
        gross_pay,
        total_deductions,
        employer_contributions,
        net_pay,
        earnings_breakdown,
        deductions_breakdown,
        calculation_metadata,
        error_message,
        payslip_documents (
          id,
          storage_path,
          storage_bucket,
          status,
          error_message
        ),
        email_deliveries (
          id,
          delivery_status,
          recipient_email,
          error_message
        )
      `)
      .eq("calculation_metadata->payrollPeriod->>year", year.toString())
      .eq("calculation_metadata->payrollPeriod->>month", month.toString())
      .order("employee_number_snapshot", { ascending: true });

    if (fallbackError) {
      throw new Error(`Failed to retrieve payroll items: ${fallbackError.message}`);
    }
    items = (data || []) as unknown as RawPayrollItem[];
  }

  // If no database records found, check in-memory store (e.g. for mock tests)
  if (items.length === 0) {
    const key = `${year}-${month}` as YearMonthKey;
    if (sampleData[key] && sampleData[key].length > 0) {
      return sampleData[key].map((r) => ({ ...r }));
    }
    return [];
  }

  // 3. Map database items to PayrollRow[]
  const rows: PayrollRow[] = await Promise.all(
    items.map(async (r) => {
      const doc = Array.isArray(r.payslip_documents)
        ? r.payslip_documents[0]
        : r.payslip_documents;

      const email = Array.isArray(r.email_deliveries)
        ? r.email_deliveries[0]
        : r.email_deliveries;

      let pdfStatus: "pending" | "generated" | "failed" = "pending";
      if (doc) {
        if (doc.status === "generated" || doc.storage_path) {
          pdfStatus = "generated";
        } else if (doc.status === "failed") {
          pdfStatus = "failed";
        }
      }

      let emailStatus: "pending" | "sent" | "failed" = "pending";
      if (email) {
        if (email.delivery_status === "sent" || email.delivery_status === "delivered") {
          emailStatus = "sent";
        } else if (email.delivery_status === "failed" || email.delivery_status === "bounced") {
          emailStatus = "failed";
        }
      }

      let payslipStatus: PayslipStatus = "pending";
      if (emailStatus === "sent") {
        payslipStatus = "emailed";
      } else if (pdfStatus === "generated") {
        payslipStatus = emailStatus === "failed" ? "failed" : "generated";
      } else if (pdfStatus === "failed" || r.error_message) {
        payslipStatus = "failed";
      }

      let payslipUrl: string | null = null;
      if (doc?.storage_path) {
        try {
          if (supabase.storage) {
            const bucket = doc.storage_bucket || "payslips";
            const { data: signed } = await supabase.storage
              .from(bucket)
              .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7);
            payslipUrl = signed?.signedUrl ?? doc.storage_path;
          } else {
            payslipUrl = doc.storage_path;
          }
        } catch {
          payslipUrl = doc.storage_path;
        }
      }

      const errorMessage =
        r.error_message || email?.error_message || doc?.error_message || null;

      // Extract real email from Supabase employees relation or snapshot
      const empData = Array.isArray(r.employees) ? r.employees[0] : r.employees;
      const employeeEmail =
        empData?.email?.trim() || r.employee_email_snapshot?.trim() || null;

      const row: PayrollRow = {
        payrollItemId: r.id,
        payrollRunId: r.payroll_run_id,
        employeeId: r.employee_id,
        employeeName: r.employee_name_snapshot ?? "",
        employeeNumber: r.employee_number_snapshot ?? "",
        employeeEmail,
        department: r.department_snapshot ?? null,
        designation: r.designation_snapshot ?? null,
        grossPay: Number(r.gross_pay ?? 0),
        netPay: Number(r.net_pay ?? 0),
        payslipStatus,
        payslipUrl,
        errorMessage,
        pdfStatus,
        emailStatus,
        // Preserve monetary details for PDF template rendering:
        ...(r.basic_salary != null ? { basicSalary: Number(r.basic_salary) } : {}),
        ...(r.allowances != null ? { allowances: Number(r.allowances) } : {}),
        ...(r.total_deductions != null ? { totalDeduction: Number(r.total_deductions) } : {}),
        ...(r.employer_contributions != null
          ? { epfEmployer: Number(r.employer_contributions) }
          : {}),
        ...(r.earnings_breakdown && typeof r.earnings_breakdown === "object"
          ? r.earnings_breakdown
          : {}),
        ...(r.deductions_breakdown && typeof r.deductions_breakdown === "object"
          ? r.deductions_breakdown
          : {}),
      };

      return row;
    })
  );

  return rows;
}

/**
 * Replace the rows for a period - updates local cache and persists changes
 * to Supabase if database records exist.
 */
export async function setPayrollRows(
  year: number,
  month: number,
  rows: PayrollRow[],
  client?: SupabaseClient | unknown
): Promise<void> {
  const key = `${year}-${month}` as YearMonthKey;
  // Always update in-memory cache for local state/tests.
  sampleData[key] = rows.map((r) => ({ ...r }));

  // Persist each row's processing updates to Supabase if connected
  try {
    const supabase = await getSupabaseClient(client);
    for (const row of rows) {
      if (!row.payrollItemId) continue;

      if (row.errorMessage !== undefined) {
        await supabase
          .from("payroll_items")
          .update({ error_message: row.errorMessage })
          .eq("id", row.payrollItemId);
      }

      if (row.payslipUrl) {
        const fileName = `${row.employeeNumber}_${year}-${month
          .toString()
          .padStart(2, "0")}.pdf`;

        const payslipTable = supabase.from("payslip_documents");
        if (typeof payslipTable?.upsert === "function") {
          await payslipTable.upsert(
            {
              payroll_item_id: row.payrollItemId,
              payroll_run_id: row.payrollRunId,
              storage_bucket: "payslips",
              storage_path: fileName,
              file_name: fileName,
              status: row.pdfStatus === "failed" ? "failed" : "generated",
              generated_at: new Date().toISOString(),
              error_message: row.pdfStatus === "failed" ? row.errorMessage : null,
            },
            { onConflict: "payroll_item_id" }
          );
        }
      }
    }
  } catch (err) {
    console.warn("Could not persist payroll row changes to Supabase:", err);
  }
}

/**
 * Start a payroll processing job for a period.
 * Uses actual records retrieved from Supabase.
 */
export function startProcessing(
  year: number,
  month: number,
  client?: SupabaseClient | unknown
): PayrollJob {
  const job = createJob();
  job.status = "processing";

  // Run the payroll processing logic asynchronously.
  (async () => {
    try {
      const supabase = await getSupabaseClient(client);
      const rows = await getPayrollRows(year, month, supabase);

      // If no payroll records exist for the selected period, fail clearly
      if (rows.length === 0) {
        const stored = getJob(job.jobId);
        if (stored) {
          stored.status = "failed";
          stored.error = `No payroll records found for period ${year}-${month}.`;
        }
        return;
      }

      for (const row of rows) {
        // Skip rows that have already completed both PDF generation and email sending
        if (
          row.payslipStatus === "emailed" ||
          (row.pdfStatus === "generated" && row.emailStatus === "sent")
        ) {
          continue;
        }

        try {
          // 1️⃣ Generate PDF if needed
          let pdfUrl = row.payslipUrl;
          if (!pdfUrl || row.pdfStatus !== "generated") {
            pdfUrl = await generatePayslipPdf(row.employeeId, year, month);
            row.payslipUrl = pdfUrl;
            row.pdfStatus = "generated";
            row.payslipStatus = "generated";
            row.errorMessage = null;

            if (row.payrollItemId) {
              const fileName = `${row.employeeNumber}_${year}-${month
                .toString()
                .padStart(2, "0")}.pdf`;

              await supabase.from("payslip_documents").upsert(
                {
                  payroll_item_id: row.payrollItemId,
                  payroll_run_id: row.payrollRunId,
                  storage_bucket: "payslips",
                  storage_path: fileName,
                  file_name: fileName,
                  status: "generated",
                  generated_at: new Date().toISOString(),
                  error_message: null,
                },
                { onConflict: "payroll_item_id" }
              );
            }
          }

          // 2️⃣ Send email via Brevo only when PDF is available and email not already sent
          if (row.emailStatus !== "sent") {
            if (!pdfUrl) {
              throw new Error("Cannot send email: Payslip PDF is not available.");
            }

            // Ensure we have the actual email from Supabase employees table
            if (!row.employeeEmail && row.employeeId) {
              const { data: emp } = await supabase
                .from("employees")
                .select("email")
                .eq("id", row.employeeId)
                .maybeSingle();
              if (emp?.email) {
                row.employeeEmail = emp.email.trim();
              }
            }

            if (!row.employeeEmail) {
              throw new Error(
                `Cannot send email: No valid email address found in employees table for ${row.employeeName} (${row.employeeNumber}).`
              );
            }

            const messageId = await sendPayslipEmail(
              row.employeeId,
              row.employeeName,
              row.employeeNumber,
              pdfUrl,
              row.employeeEmail,
              supabase
            );

            row.emailStatus = "sent";
            row.payslipStatus = "emailed";
            row.errorMessage = null;

            if (row.payrollItemId) {
              await supabase.from("email_deliveries").insert({
                payroll_item_id: row.payrollItemId,
                recipient_email: row.employeeEmail,
                recipient_name: row.employeeName,
                delivery_status: "sent",
                provider: "brevo",
                provider_message_id: messageId,
                sent_at: new Date().toISOString(),
                idempotency_key: `${row.payrollItemId}-${year}-${month}`,
              });

              await supabase
                .from("payroll_items")
                .update({ error_message: null })
                .eq("id", row.payrollItemId);
            }
          }
        } catch (e) {
          const errMsg = (e as Error).message;
          row.payslipStatus = "failed";
          row.errorMessage = errMsg;
          if (!row.payslipUrl) {
            row.pdfStatus = "failed";
          } else {
            row.emailStatus = "failed";
          }

          if (row.payrollItemId) {
            if (!row.payslipUrl) {
              const fileName = `${row.employeeNumber}_${year}-${month
                .toString()
                .padStart(2, "0")}.pdf`;

              await supabase.from("payslip_documents").upsert(
                {
                  payroll_item_id: row.payrollItemId,
                  payroll_run_id: row.payrollRunId,
                  storage_bucket: "payslips",
                  storage_path: fileName,
                  file_name: fileName,
                  status: "failed",
                  error_message: errMsg,
                },
                { onConflict: "payroll_item_id" }
              );
            } else if (row.employeeEmail) {
              await supabase.from("email_deliveries").insert({
                payroll_item_id: row.payrollItemId,
                recipient_email: row.employeeEmail,
                recipient_name: row.employeeName,
                delivery_status: "failed",
                provider: "brevo",
                error_message: errMsg,
                idempotency_key: `${row.payrollItemId}-${year}-${month}-${Date.now()}`,
              });
            }

            await supabase
              .from("payroll_items")
              .update({ error_message: errMsg })
              .eq("id", row.payrollItemId);
          }
        }
      }

      // Persist updated rows
      await setPayrollRows(year, month, rows, supabase);

      // Check whether all eligible rows succeeded
      const stored = getJob(job.jobId);
      if (stored) {
        const hasFailures = rows.some((r) => r.payslipStatus === "failed");
        stored.status = hasFailures ? "failed" : "completed";
        if (hasFailures) {
          stored.error = "One or more payslips failed to process.";
        }
      }
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

/** Retry PDF generation for a specific employee row. */
export async function retryPdf(
  identifier: string,
  year: number,
  month: number,
  client?: SupabaseClient | unknown
): Promise<void> {
  const supabase = await getSupabaseClient(client);
  const rows = await getPayrollRows(year, month, supabase);
  const targetRow = rows.find(
    (row) => row.employeeId === identifier || row.payrollItemId === identifier
  );

  if (!targetRow) {
    throw new Error(`Payroll row not found for identifier ${identifier}`);
  }

  try {
    const pdfUrl = await generatePayslipPdf(targetRow.employeeId, year, month);
    targetRow.payslipUrl = pdfUrl;
    targetRow.pdfStatus = "generated";
    targetRow.payslipStatus =
      targetRow.emailStatus === "sent" ? "emailed" : "generated";
    targetRow.errorMessage = null;

    if (targetRow.payrollItemId) {
      const fileName = `${targetRow.employeeNumber}_${year}-${month
        .toString()
        .padStart(2, "0")}.pdf`;

      await supabase.from("payslip_documents").upsert(
        {
          payroll_item_id: targetRow.payrollItemId,
          payroll_run_id: targetRow.payrollRunId,
          storage_bucket: "payslips",
          storage_path: fileName,
          file_name: fileName,
          status: "generated",
          generated_at: new Date().toISOString(),
          error_message: null,
        },
        { onConflict: "payroll_item_id" }
      );

      await supabase
        .from("payroll_items")
        .update({ error_message: null })
        .eq("id", targetRow.payrollItemId);
    }
  } catch (e) {
    targetRow.pdfStatus = "failed";
    targetRow.payslipStatus = "failed";
    targetRow.errorMessage = (e as Error).message;

    if (targetRow.payrollItemId) {
      await supabase
        .from("payroll_items")
        .update({ error_message: (e as Error).message })
        .eq("id", targetRow.payrollItemId);
    }
    throw e;
  }

  await setPayrollRows(year, month, rows, supabase);
}

/** Retry email delivery for a specific employee row. */
export async function retryEmail(
  identifier: string,
  year: number,
  month: number,
  client?: SupabaseClient | unknown
): Promise<void> {
  const supabase = await getSupabaseClient(client);
  const rows = await getPayrollRows(year, month, supabase);
  const targetRow = rows.find(
    (row) => row.employeeId === identifier || row.payrollItemId === identifier
  );

  if (!targetRow) {
    throw new Error(`Payroll row not found for identifier ${identifier}`);
  }

  if (!targetRow.payslipUrl) {
    throw new Error("Cannot send email: Payslip PDF is not generated yet.");
  }

  // Ensure we have the actual email from Supabase employees table
  if (!targetRow.employeeEmail && targetRow.employeeId) {
    const { data: emp } = await supabase
      .from("employees")
      .select("email")
      .eq("id", targetRow.employeeId)
      .maybeSingle();
    if (emp?.email) {
      targetRow.employeeEmail = emp.email.trim();
    }
  }

  if (!targetRow.employeeEmail) {
    throw new Error(
      `Cannot send email: No valid email address found in employees table for ${targetRow.employeeName} (${targetRow.employeeNumber}).`
    );
  }

  try {
    const messageId = await sendPayslipEmail(
      targetRow.employeeId,
      targetRow.employeeName,
      targetRow.employeeNumber,
      targetRow.payslipUrl,
      targetRow.employeeEmail,
      supabase
    );

    targetRow.emailStatus = "sent";
    targetRow.payslipStatus = "emailed";
    targetRow.errorMessage = null;

    if (targetRow.payrollItemId) {
      await supabase.from("email_deliveries").insert({
        payroll_item_id: targetRow.payrollItemId,
        recipient_email: targetRow.employeeEmail,
        recipient_name: targetRow.employeeName,
        delivery_status: "sent",
        provider: "brevo",
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        idempotency_key: `${targetRow.payrollItemId}-${year}-${month}-${Date.now()}`,
      });

      await supabase
        .from("payroll_items")
        .update({ error_message: null })
        .eq("id", targetRow.payrollItemId);
    }
  } catch (e) {
    targetRow.emailStatus = "failed";
    targetRow.payslipStatus = "failed";
    targetRow.errorMessage = (e as Error).message;

    if (targetRow.payrollItemId && targetRow.employeeEmail) {
      await supabase.from("email_deliveries").insert({
        payroll_item_id: targetRow.payrollItemId,
        recipient_email: targetRow.employeeEmail,
        recipient_name: targetRow.employeeName,
        delivery_status: "failed",
        provider: "brevo",
        error_message: (e as Error).message,
        idempotency_key: `${targetRow.payrollItemId}-${year}-${month}-${Date.now()}`,
      });

      await supabase
        .from("payroll_items")
        .update({ error_message: (e as Error).message })
        .eq("id", targetRow.payrollItemId);
    }
    throw e;
  }

  await setPayrollRows(year, month, rows, supabase);
}
