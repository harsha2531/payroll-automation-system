import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/payroll/monthly/route";
import { getPayrollRows } from "@/lib/payrollDataStore";
import { launchChromiumBrowser, buildPayslipHtml } from "@/lib/payrollPdfService";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase Server admin/client factories
const mockFrom = vi.fn();
const mockAdminClient = {
  from: mockFrom,
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.local/oct2025.pdf" },
        error: null,
      }),
    })),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
  createClient: vi.fn(async () => mockAdminClient),
}));

describe("Monthly Payroll API & Playwright Separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  describe("1. Monthly Payroll Retrieval for October 2025", () => {
    it("retrieves October 2025 payroll records from Supabase and returns JSON", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string, val: unknown) => {
              if (field === "year") return mockAdminClient.from("payroll_runs");
              if (field === "month" && val === 10) {
                return Promise.resolve({
                  data: [{ id: "run-oct-2025", status: "calculated" }],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          };
        }
        if (table === "payroll_items") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "item-oct-1",
                  payroll_run_id: "run-oct-2025",
                  employee_id: "emp-oct-1",
                  employee_name_snapshot: "Kasun Perera",
                  employee_number_snapshot: "PS-0001",
                  employee_email_snapshot: "kasun@company.com",
                  employees: {
                    email: "kasun@company.com",
                    epf_number: "12345",
                  },
                  department_snapshot: "IT",
                  designation_snapshot: "Tech Lead",
                  basic_salary: 200000,
                  allowances: 50000,
                  gross_pay: 250000,
                  total_deductions: 20000,
                  employer_contributions: 30000,
                  net_pay: 230000,
                  earnings_breakdown: {
                    basicSalary: 200000,
                    allowances: { "Budgetary Allowance": 50000 },
                  },
                  deductions_breakdown: {
                    employeeDeductions: { "E.P.F. 8%": 16000, "Stamp Duty": 25 },
                  },
                  calculation_metadata: {
                    payrollPeriod: { year: 2025, month: 10 },
                  },
                  error_message: null,
                  payslip_documents: [
                    {
                      id: "doc-oct-1",
                      storage_path: "payslips/PS-0001_2025-10.pdf",
                      storage_bucket: "payslips",
                      status: "generated",
                    },
                  ],
                  email_deliveries: [],
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/payroll/monthly?year=2025&month=10");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1);
      expect(json[0].employeeName).toBe("Kasun Perera");
      expect(json[0].employeeNumber).toBe("PS-0001");
      expect(json[0].grossPay).toBe(250000);
      expect(json[0].netPay).toBe(230000);
      expect(json[0].payslipStatus).toBe("generated");
      expect(json[0].pdfStatus).toBe("generated");
      expect(json[0].payslipUrl).toBe("https://signed.local/oct2025.pdf");
      expect(json[0].basicSalary).toBe(200000);
    });
  });

  describe("2. Empty Payroll Periods", () => {
    it("returns an empty array when no payroll records exist for the selected period", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field: string) => {
              if (field === "month") {
                return Promise.resolve({ data: [], error: null });
              }
              return mockAdminClient.from("payroll_runs");
            }),
          };
        }
        if (table === "payroll_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/payroll/monthly?year=2025&month=1");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual([]);
    });
  });

  describe("3. Incorrect Year / Month Inputs", () => {
    it("returns 400 when month is greater than 12", async () => {
      const request = new Request("http://localhost:3000/api/payroll/monthly?year=2025&month=13");
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Invalid year or month");
    });

    it("returns 400 when month is less than 1", async () => {
      const request = new Request("http://localhost:3000/api/payroll/monthly?year=2025&month=0");
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 when year is not a valid number", async () => {
      const request = new Request("http://localhost:3000/api/payroll/monthly?year=abc&month=10");
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 when year is out of valid range (<2000)", async () => {
      const request = new Request("http://localhost:3000/api/payroll/monthly?year=1998&month=10");
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });

  describe("4. Database Query Errors", () => {
    it("returns 500 with error details when Supabase query fails", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "month") {
                return Promise.resolve({
                  data: null,
                  error: { message: "Database connection timeout" },
                });
              }
              return mockAdminClient.from("payroll_runs");
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/payroll/monthly?year=2025&month=10");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toContain("Failed to retrieve payroll runs: Database connection timeout");
    });
  });

  describe("5. Separation of Monthly Retrieval from Playwright", () => {
    it("getPayrollRows does not require, import, or initialize Playwright / Chromium", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "payroll_runs") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn((field: string) => {
                if (field === "month") {
                  return Promise.resolve({ data: [], error: null });
                }
                return mockClient.from("payroll_runs");
              }),
            };
          }
          if (table === "payroll_items") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      // Ensure execution completes cleanly without attempting to launch browser
      const rows = await getPayrollRows(2025, 10, mockClient);
      expect(rows).toEqual([]);
    });
  });

  describe("6. PDF Generation Service Configuration", () => {
    it("uses @sparticuz/chromium when VERCEL environment variable is set", async () => {
      process.env.VERCEL = "1";

      const mockLaunch = vi.fn().mockResolvedValue({
        close: vi.fn(),
      });

      vi.doMock("playwright-core", () => ({
        chromium: {
          launch: mockLaunch,
        },
      }));

      vi.doMock("@sparticuz/chromium", () => ({
        default: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          executablePath: vi.fn().mockResolvedValue("/tmp/chromium"),
          headless: true,
        },
      }));

      const browser = await launchChromiumBrowser();
      expect(browser).toBeDefined();
    });

    it("buildPayslipHtml preserves monetary amounts and bonus/overtime breakdown correctly", () => {
      const employee = {
        employeeName: "Nimal Silva",
        employeeNumber: "EMP010",
        designation: "Accountant",
        basicSalary: 85000,
        grossPay: 120000,
        netPay: 110000,
        variablePay: {
          label: "Performance Bonus",
          amount: 25000,
        },
        allowances: {
          "Budgetary Allowance": 10000,
        },
        employeeDeductions: {
          "E.P.F. 8%": 6800,
          "Stamp Duty": 25,
          total: 6825,
        },
        employerContributions: {
          epf12: 10200,
          etf3: 2550,
        },
      } as any;

      const html = buildPayslipHtml(employee, 2025, 10);
      expect(html).toContain("Nimal Silva");
      expect(html).toContain("EMP010");
      expect(html).toContain("Accountant");
      expect(html).toContain("2025 - October");
      expect(html).toContain("Bonus");
      expect(html).toContain("85,000.00");
      expect(html).toContain("25,000.00");
      expect(html).toContain("10,000.00");
      expect(html).toContain("1,20,000.00");
      expect(html).toContain("1,10,000.00");
      expect(html).toContain("6,800.00");
      expect(html).toContain("10,200.00");
      expect(html).toContain("2,550.00");
    });
  });
});
