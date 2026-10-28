// src/lib/brevoEmailService.ts
/**
 * Simple Brevo (formerly Sendinblue) email integration for sending a payslip PDF.
 * This module exports a function that the payroll processing job calls.
 *
 * It expects the following environment variables to be defined:
 *   BREVO_API_KEY – your Brevo transactional API key.
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY – used only if you
 *   need to look up the employee's real email from Supabase. For the demo we
 *   construct a deterministic email address from the employeeNumber.
 */

import { BrevoClient } from "@getbrevo/brevo";

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
if (!BREVO_API_KEY) {
  console.warn("BREVO_API_KEY is not set – email sending will fail.");
}

const brevo = new BrevoClient({ apiKey: BREVO_API_KEY });

/**
 * Send a payslip PDF to the employee via Brevo.
 * @param employeeId   The payroll row identifier (used only for logging).
 * @param employeeName Human‑readable name for the email greeting.
 * @param employeeNumber Employee number – used here to synthesize an email address.
 * @param pdfUrl       Signed URL to the generated PDF.
 * @returns           The Brevo messageId for tracking.
 */
export async function sendPayslipEmail(
  employeeId: string,
  employeeName: string,
  employeeNumber: string,
  pdfUrl: string,
): Promise<string> {
  // In a real system you would query the Users table for the actual address.
  const toEmail = `${employeeNumber}@example.com`;

  const response = await brevo.smtp.sendTransacEmail({
    sender: { name: "Startup Solutions (Pvt)Ltd", email: "harshanimeda@gmail.com" },
    to: [{ email: toEmail, name: employeeName }],
    subject: "Your Monthly Payslip",
    htmlContent: `<p>Dear ${employeeName},</p><p>Please find attached your payslip for the selected period.</p>`,
    attachment: [{ url: pdfUrl, name: `Payslip_${employeeNumber}.pdf` }],
  });

  if (response?.messageId) {
    return response.messageId;
  }
  // Brevo returns an object with an error field when something goes wrong.
  throw new Error(`Brevo email failed: ${JSON.stringify(response)}`);
}

