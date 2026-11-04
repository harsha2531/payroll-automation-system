// src/lib/brevoEmailService.ts
/**
 * Brevo email integration for sending a payslip PDF.
 * Uses the employee's actual email address from the Supabase employees table.
 */

import { BrevoClient } from "@getbrevo/brevo";
import type { SupabaseClient } from "@supabase/supabase-js";


const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
if (!BREVO_API_KEY) {
  console.warn("BREVO_API_KEY is not set – email sending will fail.");
}

const brevo = new BrevoClient({ apiKey: BREVO_API_KEY });

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
 * Send a payslip PDF to the employee via Brevo.
 * Fetches the actual email address from Supabase `employees` table if not provided.
 *
 * @param employeeId     The employee ID (used to query employees table).
 * @param employeeName   Human‑readable name for the email greeting.
 * @param employeeNumber Employee number shown on payslip attachment.
 * @param pdfUrl         Signed URL to the generated PDF.
 * @param recipientEmail Optional explicit recipient email from snapshot/database.
 * @param client         Optional Supabase client instance (for testing or reuse).
 * @returns             The Brevo messageId for tracking.
 */

/** Convert month number (1‑12) to English month name */
function monthName(month: number): string {
  const date = new Date(2000, month - 1, 1); // year irrelevant
  return date.toLocaleString("default", { month: "long" });
}

export async function sendPayslipEmail(
  employeeId: string,
  employeeName: string,
  employeeNumber: string,
  pdfUrl: string,
  month: number,
  year: number,
  recipientEmail?: string | null,
  client?: SupabaseClient | unknown,
): Promise<string> {
  let toEmail = recipientEmail?.trim();

  // Period header with month name
  const period = `${year} - ${monthName(month)}`;

  // If email is not passed directly, look up the actual email from Supabase employees table
  if (!toEmail) {
    const supabase = await getSupabaseClient(client);
    const { data: emp, error } = await supabase
      .from("employees")
      .select("email")
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch email for employee ${employeeId}: ${error.message}`);
    }

    toEmail = emp?.email?.trim();
  }

  if (!toEmail) {
    throw new Error(
      `No email address found in database for employee ${employeeName} (Number: ${employeeNumber}, ID: ${employeeId})`
    );
  }

  const response = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: "Startup Solutions (Pvt)Ltd", email: "[EMAIL_ADDRESS]" },
    to: [{ email: toEmail, name: employeeName }],
    subject: "Your Monthly Payslip",
    htmlContent: `<p>Dear ${employeeName},</p><p>Please find attached your payslip for ${period}.</p>
                  <br><br>
                  <p>
                  Regards,
                  HR Department,
                  Startup Solutions (Pvt)Ltd,
                  No.18, Ekwatta Road, Mirihana, Nugegoda,
                  Sri Lanka.
                  </p>
    `,
    attachment: [{ url: pdfUrl, name: `Payslip_${employeeNumber}.pdf` }],
  });

  if (response?.messageId) {
    return response.messageId;
  }
  // Brevo returns an object with an error field when something goes wrong.
  throw new Error(`Brevo email failed: ${JSON.stringify(response)}`);
}
