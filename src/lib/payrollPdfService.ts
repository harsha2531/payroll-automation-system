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

// Helper to obtain Supabase client with privileged service role key
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(supabaseUrl, supabaseKey);
}

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
export function buildPayslipHtml(
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

  // Remove any rows with zero amount (except Basic Salary or variable pay with a label)
  const earningsRows = earnings.filter(
    (e) => e.value !== 0 || e.label === "Basic Salary" || (variableLabel && e.label === variableLabel || e.label === "Less : No Pay")
  );

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

  // HTML template – compact, professional A4 styling fitting neatly on one page
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 12.5px;
      line-height: 1.35;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .company-title {
      font-size: 19px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .company-sub {
      margin-top: 2px;
      font-size: 11.5px;
      color: #64748b;
    }
    .header-right {
      text-align: right;
    }
    .payslip-badge {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.8px;
      line-height: 1.2;
    }
    .period-text {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 1px;
    }
    .date-text {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 1px;
    }

    .employee-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 12px;
      margin-bottom: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 16px;
      font-size: 12px;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
      margin-right: 6px;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
    }

    .section {
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4.5px 8px;
      text-align: left;
      font-size: 12px;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #334155;
    }
    .amount-col {
      text-align: right;
      font-variant-numeric: tabular-nums;
      width: 140px;
    }
    .totals-row {
      font-weight: 700;
      background-color: #f8fafc;
      border-top: 2px solid #94a3b8;
    }

    .net-salary-card {
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .net-label {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .net-amount {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .disclaimer {
      font-size: 10.5px;
      color: #64748b;
      line-height: 1.35;
      margin-top: 8px;
      padding: 5px 8px;
      background: #f8fafc;
      border-left: 3px solid #cbd5e1;
      border-radius: 2px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .signature-container {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .signature-block {
      text-align: center;
      min-width: 220px;
    }
    .sig-company {
      font-size: 11.5px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 30px;
    }
    .sig-line {
      border-top: 1px solid #64748b;
      margin-bottom: 3px;
    }
    .sig-name {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
    }
    .sig-title {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="company-title">STARTUP SOLUTIONS (PVT) LTD</h1>
      <p class="company-sub">No.18, Ekwatta Road, Mirihana, Nugegoda</p>
    </div>
    <div class="header-right">
      <div class="payslip-badge">PAYSLIP</div>
      <div class="period-text">${period}</div>
      <div class="date-text">Date: ${signatureDate}</div>
    </div>
  </div>

  <div class="employee-card">
    <div><span class="info-label">Employee Name:</span><span class="info-value">${employee.employeeName}</span></div>
    <div><span class="info-label">Designation:</span><span class="info-value">${employee.designation ?? "-"}</span></div>
    <div><span class="info-label">Employee No:</span><span class="info-value">${employee.employeeNumber}</span></div>
    <div><span class="info-label">EPF No:</span><span class="info-value">${employee.epfNumber ?? "-"}</span></div>
    <div><span class="info-label">Department:</span><span class="info-value">IT</span></div>
  </div>

  <div class="section">
    <div class="section-title">Earnings (Rs.)</div>
    <table>
      <thead>
        <tr><th>Description</th><th class="amount-col">Amount</th></tr>
      </thead>
      <tbody>
        ${earningsRows.map((e) => `<tr><td>${e.label}</td><td class="amount-col">${fmt(e.value)}</td></tr>`).join("")}
        <tr class="totals-row"><td>Gross Salary</td><td class="amount-col">${fmt(grossPay)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Deductions (Rs.)</div>
    <table>
      <thead>
        <tr><th>Description</th><th class="amount-col">Amount</th></tr>
      </thead>
      <tbody>
        ${deductions.map((d) => `<tr><td>${d.label}</td><td class="amount-col">${fmt(d.value)}</td></tr>`).join("")}
        <tr class="totals-row"><td>Total Deduction</td><td class="amount-col">${fmt(totalDeduction)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="net-salary-card">
    <span class="net-label">Net Salary</span>
    <span class="net-amount">${fmt(netPay)}</span>
  </div>

  <div class="section">
    <div class="section-title">Employer Contributions (Rs.)</div>
    <table>
      <thead>
        <tr><th>Description</th><th class="amount-col">Amount</th></tr>
      </thead>
      <tbody>
        ${employerContributions.map((c) => `<tr><td>${c.label}</td><td class="amount-col">${fmt(c.value)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <p class="disclaimer">
    "This payslip serves as an official record of earnings and deductions for the specified period. Any discrepancies must be reported to the HR &amp; Payroll department within 7 business days."
  </p>

  <div class="signature-container">
    <div class="signature-block">
      <p class="sig-company">For Startup Solutions (PVT) LTD</p>
      <div class="sig-line"></div>
      <p class="sig-name">Mr. Chandana Perera</p>
      <p class="sig-title">Managing Director</p>
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
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "15mm", right: "15mm" },
  });
  await browser.close();

  // 4. Upload to Supabase Storage (private bucket "payslips").
  const supabase = getSupabaseClient();
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
