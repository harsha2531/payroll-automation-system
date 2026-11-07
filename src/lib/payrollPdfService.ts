// src/lib/payrollPdfService.ts
/**
 * Service for generating a payslip PDF for a given employee and period.
 * Uses Playwright to render HTML to PDF and Supabase Storage to persist the file.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { PayrollRow } from "@/types/payroll-ui";
import { getPayrollRows } from "./payrollDataStore";
import { PayrollRecord } from "@/services/payroll-parser";

// Initialise Supabase client (service role key for privileged storage access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""; // must be set in env
const supabase = createClient(supabaseUrl, supabaseKey);

/** Simple filename sanitiser – removes characters unsafe for URLs/files. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-");
}

/** Convert month number (1‑12) to English month name */
function monthName(month: number): string {
  const date = new Date(2000, month - 1, 1); // year irrelevant
  return date.toLocaleString("default", { month: "long" });
}

/** Build HTML for the payslip using stored payroll data. */
function buildPayslipHtml(
  employee: PayrollRecord,
  year: number,
  month: number,
): string {
  // Period header with month name
  const period = `${year} - ${monthName(month)}`;
  // Extract core fields directly from employee
  const {
    grossPay = 0,
    netPay = 0,
    signatureDate = new Date().toLocaleDateString(),
    signatureName = "Authorized Signature",
    variablePay: variablePayRaw = 0,
  } = employee as any;

  // Merge breakdown JSON fields if they exist
  const earningsBreakdown = (employee as any).allowances || {};
  const deductionsBreakdown = (employee as any).employeeDeductions || {};

  // Allowances extraction
  const budgetaryAllowance = Number(earningsBreakdown["Budgetary Allowance"] ?? 0);
  const travellingAllowance = Number(earningsBreakdown["Travelling Allowance"] ?? 0);
  const inflationAdjustment = Number(earningsBreakdown["Inflation Adjustment"] ?? 0);
  const additionalAllowance = Number(earningsBreakdown["Additional Allowance"] ?? 0);
  const basicSalary = Number(employee.basicSalary ?? 0);


  // Variable pay handling – expect object { label: string, amount: number }

  const variablePayObj =
    typeof variablePayRaw === "object" && variablePayRaw !== null
      ? variablePayRaw
      : null;

  let variableLabel = "";
  let variableAmount = 0;

  if (variablePayObj) {
    const rawLabel = String(variablePayObj.label ?? "").trim();
    const normalizedLabel = rawLabel.toLowerCase();

    if (normalizedLabel.includes("bonus")) {
      variableLabel = "Bonus";
    } else if (
      normalizedLabel.includes("overtime") ||
      normalizedLabel.includes("over time")
    ) {
      variableLabel = "Overtime";
    } else if (rawLabel) {
      // Preserve the original label if it is neither Bonus nor Overtime.
      variableLabel = rawLabel;
    }

    variableAmount =
      typeof variablePayObj.amount === "number" &&
        Number.isFinite(variablePayObj.amount)
        ? variablePayObj.amount
        : 0;
  }


  // Deductions extraction
  const lessNoPay = Number(deductionsBreakdown["Less : No Pay"] ?? 0);
  const epfEmployee = Number(deductionsBreakdown["E.P.F. 8%"] ?? 0);
  const stampDuty = Number(deductionsBreakdown["Stamp Duty"] ?? 0);
  const totalDeduction = Number(deductionsBreakdown["total"] ?? 0);

  const employerContribs = (employee as any).employerContributions || {};

  const epfEmployer = Number(employerContribs["epf12"] ?? 0);
  const etfEmployer = Number(employerContribs["etf3"] ?? 0);



  const earnings = [
    { label: "Basic Salary", value: basicSalary },
    { label: "Budgetary Allowance", value: budgetaryAllowance },
    { label: "Travelling Allowance", value: travellingAllowance },
    { label: "Inflation Adjustment", value: inflationAdjustment },
    { label: "Additional Allowance", value: additionalAllowance },
    // Include variable pay whenever a valid label exists, even if amount is 0
    ...(variableLabel.trim() ? [{ label: variableLabel, value: variableAmount }] : []),
    { label: "Less : No Pay", value: lessNoPay },
  ];

  // Remove any rows with zero amount (except Basic Salary which may be zero?)
  const earningsRows = earnings.filter(e => e.value !== 0 || e.label === "Basic Salary");


  const deductions = [
    { label: "E.P.F. 8%", value: epfEmployee },
    { label: "Stamp Duty", value: stampDuty },
    // Total Deduction will be displayed in the totals row below, not duplicated here
  ];

  const employerContributions = [
    { label: "E.P.F. 12%", value: epfEmployer },
    { label: "E.T.F. 3%", value: etfEmployer },
  ];

  // Helper to format money as Rs.
  const fmt = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // HTML template – professional styling and right‑aligned date
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; margin: 20px; color: #2c3e50;}
    .header {display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #34495e; padding-bottom: 10px; margin-bottom: 20px;}
    .header .title {text-align: center; flex-grow: 1;}
    .header .title h1 {margin: 0; font-size: 24px; color: #2c3e50;}
    .header .title h3 {margin: 4px 0; font-weight: normal; font-size: 16px;}
    .header .date {font-size: 14px; text-align: right; white-space: nowrap;}
    .section {margin-top: 15px;}
    table {width: 100%; border-collapse: collapse;}
    th, td {border: 1px solid #bdc3c7; padding: 8px; text-align: left;}
    th {background: #ecf0f1;}
    .totals {font-weight: bold; background: #f8f9fa;}
    .signature {margin-top: 40px; display: flex; justify-content: flex-end;}
    .signature div {text-align: center;}
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      <h1>STARTUP SOLUTIONS (PVT) LTD</h1>
      <h3>No.18, Ekwatta Road, Mirihana, Nugegoda</h3>
      <p>Payslip for <strong>${period}</strong></p>
    </div>
    <div class="date">Date: ${signatureDate}</div>
  </div>

  <div class="section">
    <strong>Employee:</strong> ${employee.employeeName}<br/>
    <strong>Employee No:</strong> ${employee.employeeNumber}<br/>
    <strong>Department:</strong> IT <br/>
    <strong>Designation:</strong> ${employee.designation ?? "-"}<br/>
  </div>

  <div class="section">
    <h3>Earnings (Rs.)</h3>
    <table>
      <thead>
        <tr><th>Description</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${earningsRows.map(e => `<tr><td>${e.label}</td><td>${fmt(e.value)}</td></tr>`).join("")}
        <tr class="totals"><td>Gross Salary</td><td>${fmt(grossPay)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Deductions (Rs.)</h3>
    <table>
      <thead>
        <tr><th>Description</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${deductions.map(d => `<tr><td>${d.label}</td><td>${fmt(d.value)}</td></tr>`).join("")}
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
      <thead>
        <tr><th>Description</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${employerContributions.map(c => `<tr><td>${c.label}</td><td>${fmt(c.value)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="signature">
    <div>
      <p>Date: ${signatureDate}</p>
      <br>
      <p>______________________</p>
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
  const rows = await getPayrollRows(year, month);
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
  const fileName = `${sanitizeFilename(employee.employeeNumber)}_${year}-${month.toString().padStart(2, "0")}.pdf`;
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
