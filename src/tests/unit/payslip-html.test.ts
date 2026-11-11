import { describe, it, expect } from "vitest";
import { buildPayslipHtml, launchChromiumBrowser } from "@/lib/payrollPdfService";
import { PayrollRecord } from "@/services/payroll-parser";

describe("buildPayslipHtml", () => {
  const sampleEmployee: PayrollRecord = {
    employeeName: "Johnathan Smith",
    employeeNumber: "EMP001",
    designation: "Senior Software Engineer",
    basicSalary: 150000,
    grossPay: 215000,
    netPay: 202975,
    allowances: {
      "Budgetary Allowance": 10000,
      "Travelling Allowance": 25000,
      "Inflation Adjustment": 15000,
      "Additional Allowance": 15000,
    },
    employeeDeductions: {
      "E.P.F. 8%": 12000,
      "Stamp Duty": 25,
      total: 12025,
    },
    employerContributions: {
      epf12: 18000,
      etf3: 4500,
    },
    variablePay: {
      label: "Bonus",
      amount: 15000,
    },
  } as any;

  it("1. Generates HTML containing all required fields and A4 styling", () => {
    const html = buildPayslipHtml(sampleEmployee, 2026, 11);

    expect(html).toContain("@page");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("STARTUP SOLUTIONS (PVT) LTD");
    expect(html).toContain("Johnathan Smith");
    expect(html).toContain("EMP001");
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain("IT");
    expect(html).toContain("Basic Salary");
    expect(html).toContain("Budgetary Allowance");
    expect(html).toContain("Travelling Allowance");
    expect(html).toContain("Inflation Adjustment");
    expect(html).toContain("Additional Allowance");
    expect(html).toContain("Bonus");
    expect(html).toContain("Gross Salary");
    expect(html).toContain("E.P.F. 8%");
    expect(html).toContain("Stamp Duty");
    expect(html).toContain("Total Deduction");
    expect(html).toContain("Net Salary");
    expect(html).toContain("Employer Contributions (Rs.)");
    expect(html).toContain("E.P.F. 12%");
    expect(html).toContain("E.T.F. 3%");
    expect(html).toContain("Mr. Chandana Perera");
    expect(html).toContain("Managing Director");
    expect(html).toContain("break-inside: avoid");
  });

  it("2. Playslip renders on exactly 1 A4 page with Playwright", async () => {
    const html = buildPayslipHtml(sampleEmployee, 2026, 11);
    const browser = await launchChromiumBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "15mm", right: "15mm" },
      });

      const pdfText = pdfBuffer.toString("latin1");
      const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
      expect(pageCount).toBe(1);
    } finally {
      await browser.close();
    }
  });
});

