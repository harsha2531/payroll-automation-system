// src/lib/payrollPdfService.ts
/**
 * Service for generating a payslip PDF for a given employee and period.
 * Uses Playwright to render HTML to PDF and Supabase Storage to persist the file.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { PayrollRow } from "@/types/payroll-ui";
import { getPayrollRows } from "./payrollDataStore";

// Initialise Supabase client (service role key for privileged storage access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""; // must be set in env
const supabase = createClient(supabaseUrl, supabaseKey);

/** Simple filename sanitiser – removes characters unsafe for URLs/files. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-");
}

/** Build HTML for the payslip using stored payroll data. */
function buildPayslipHtml(
  employee: PayrollRow,
  year: number,
  month: number,
): string {
  const period = `${year}-${month.toString().padStart(2, "0")}`;
  // The UI already provides the required numeric fields.
  const {
    grossPay,
    netPay,
    // Assuming the UI extensions contain these optional fields – fallback to 0.
    // Types may be extended in the future.
    // @ts-ignore – extra fields are optional.
    basicSalary = grossPay,
    // @ts-ignore
    budgetaryAllowance = 0,
    // @ts-ignore
    travellingAllowance = 0,
    // @ts-ignore
    inflationAdjustment = 0,
    // @ts-ignore
    additionalAllowance = 0,
    // @ts-ignore
    variablePay = 0,
    // @ts-ignore
    noPay = 0,
    // @ts-ignore
    epfEmployee = 0,
    // @ts-ignore
    stampDuty = 0,
    // @ts-ignore
    totalDeduction = 0,
    // @ts-ignore
    epfEmployer = 0,
    // @ts-ignore
    etfEmployer = 0,
    // @ts-ignore
    signatureDate = new Date().toLocaleDateString(),
    // @ts-ignore
    signatureName = "Authorized Signatory",
  } = employee as any;

  const earnings = [
    { label: "Basic Salary", value: basicSalary },
    { label: "Budgetary Allowance", value: budgetaryAllowance },
    { label: "Travelling Allowance", value: travellingAllowance },
    { label: "Inflation Adjustment", value: inflationAdjustment },
    { label: "Additional Allowance", value: additionalAllowance },
    { label: "Bonus/Over Time (variablePay)", value: variablePay },
    { label: "Less : No Pay", value: noPay },
  ];
  const deductions = [
    { label: "E.P.F. 8%", value: epfEmployee },
    { label: "Stamp Duty", value: stampDuty },
    { label: "Total Deduction", value: totalDeduction },
  ];
  const employerContributions = [
    { label: "E.P.F. 12%", value: epfEmployer },
    { label: "E.T.F. 3%", value: etfEmployer },
  ];

  // Helper to format money as Rs.
  const fmt = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {font-family: Arial, Helvetica, sans-serif; margin: 40px; color: #333;}
    .header {text-align: center; margin-bottom: 20px;}
    .header h1 {margin: 0; color: #2c3e50;}
    .section {margin-top: 20px;}
    table {width: 100%; border-collapse: collapse; margin-top: 8px;}
    th, td {border: 1px solid #ddd; padding: 8px; text-align: left;}
    th {background: #f4f4f4;}
    .totals {font-weight: bold; background: #fafafa;}
    .signature {margin-top: 40px; display: flex; justify-content: flex-end;}
    .signature div {text-align: center;}
  </style>
</head>
<body>
  <div class="header">
    <h1>Company Name Ltd.</h1>
    <p>Payslip for <strong>${period}</strong></p>
  </div>

  <div class="section">
    <strong>Employee:</strong> ${employee.employeeName}<br/>
    <strong>Employee No:</strong> ${employee.employeeNumber}<br/>
    <strong>Department:</strong> ${employee.department ?? "-"}<br/>
    <strong>Designation:</strong> ${employee.designation ?? "-"}<br/>
  </div>

  <div class="section">
    <h3>Earnings (Rs.)</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        ${earnings
          .map((e) => `<tr><td>${e.label}</td><td>${fmt(e.value)}</td></tr>`)
          .join("")}
        <tr class="totals"><td>Gross Salary</td><td>${fmt(grossPay)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Deductions (Rs.)</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        ${deductions
          .map((d) => `<tr><td>${d.label}</td><td>${fmt(d.value)}</td></tr>`)
          .join("")}
        <tr class="totals"><td>Total Deduction</td><td>${fmt(totalDeduction)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Net Salary</h3>
    <table>
      <tbody>
        <tr class="totals"><td>Net Salary</td><td>${fmt(netPay)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Employer Contributions (Rs.)</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        ${employerContributions
          .map((c) => `<tr><td>${c.label}</td><td>${fmt(c.value)}</td></tr>`)
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="signature">
    <div>
      <p>Date: ${signatureDate}</p>
      <p>Signature: ______________________</p>
      <p>${signatureName}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate PDF for an employee and upload to Supabase Storage.
 * Returns the public (signed) URL of the stored PDF.
 */
export async function generatePayslipPdf(
  employeeId: string,
  year: number,
  month: number,
): Promise<string> {
  // 1. Retrieve payroll row for the employee.
  const rows = getPayrollRows(year, month);
  const employee = rows.find((r) => r.employeeId === employeeId);
  if (!employee) {
    throw new Error(`Payroll row not found for employee ${employeeId}`);
  }

  // 2. Build HTML.
  const html = buildPayslipHtml(employee, year, month);

  // 3. Launch Playwright headless Chromium.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" } });
  await browser.close();

  // 4. Upload to Supabase Storage (private bucket "payslips").
  const fileName = `${sanitizeFilename(employee.employeeNumber)}_${year}-${month
    .toString()
    .padStart(2, "0")}.pdf`;
  const bucket = "payslips";
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // 5. Generate a signed URL (valid 7 days) for authorized access.
  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 60 * 60 * 24 * 7);
  if (signErr) {
    throw new Error(`Failed to create signed URL: ${signErr.message}`);
  }
  return signed?.signedUrl ?? data.path; // fallback to path if signed URL generation fails.
}

