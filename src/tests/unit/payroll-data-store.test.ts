import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPayrollRows,
  startProcessing,
  retryPdf,
  retryEmail,
  getJobStatus,
} from "@/lib/payrollDataStore";
import * as pdfService from "@/lib/payrollPdfService";
import * as emailService from "@/lib/brevoEmailService";

vi.mock("@/lib/payrollPdfService", () => ({
  generatePayslipPdf: vi.fn(),
}));

vi.mock("@/lib/brevoEmailService", () => ({
  sendPayslipEmail: vi.fn(),
}));

describe("payrollDataStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. getPayrollRows() retrieves actual saved payroll records for selected period from Supabase including real employee email", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "year") return mockSupabase.from("payroll_runs");
              if (field === "month") {
                return Promise.resolve({
                  data: [{ id: "run-2026-11", status: "completed" }],
                  error: null,
                });
              }
              return mockSupabase.from("payroll_runs");
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
                  id: "item-1",
                  payroll_run_id: "run-2026-11",
                  employee_id: "emp-101",
                  employee_name_snapshot: "John Smith",
                  employee_number_snapshot: "EMP001",
                  employee_email_snapshot: "john.snapshot@company.com",
                  employees: {
                    email: "john.authoritative@company.com",
                  },
                  department_snapshot: "Engineering",
                  designation_snapshot: "Lead Developer",
                  gross_pay: 150000,
                  net_pay: 135000,
                  basic_salary: 120000,
                  allowances: 30000,
                  total_deductions: 15000,
                  employer_contributions: 18000,
                  error_message: null,
                  payslip_documents: [
                    {
                      id: "doc-1",
                      storage_path: "payslips/EMP001_2026-11.pdf",
                      status: "generated",
                    },
                  ],
                  email_deliveries: [
                    {
                      id: "email-1",
                      delivery_status: "sent",
                      recipient_email: "john.authoritative@company.com",
                    },
                  ],
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://supabase.local/signed/EMP001.pdf" },
            error: null,
          }),
        })),
      },
    };

    const rows = await getPayrollRows(2026, 11, mockSupabase as unknown as SupabaseClient);

    expect(rows).toHaveLength(1);
    expect(rows[0].employeeId).toBe("emp-101");
    expect(rows[0].employeeName).toBe("John Smith");
    expect(rows[0].employeeNumber).toBe("EMP001");
    expect(rows[0].employeeEmail).toBe("john.authoritative@company.com");
    expect(rows[0].grossPay).toBe(150000);
    expect(rows[0].netPay).toBe(135000);
    expect(rows[0].payslipStatus).toBe("emailed");
    expect(rows[0].pdfStatus).toBe("generated");
    expect(rows[0].emailStatus).toBe("sent");
    expect(rows[0].payslipUrl).toBe("https://supabase.local/signed/EMP001.pdf");
    expect(rows[0].payrollItemId).toBe("item-1");
  });

  it("2. The processing function receives retrieved records and handles period with no records correctly", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field: string) => {
              if (field === "month") {
                return Promise.resolve({ data: [], error: null });
              }
              return mockSupabase.from("payroll_runs");
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
    };

    const job = startProcessing(2025, 1, mockSupabase as unknown as SupabaseClient);
    // Allow async processing to run
    await new Promise((r) => setTimeout(r, 50));

    const status = getJobStatus(job.jobId);
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("No payroll records found for period 2025-1");
  });

  it("3. Every eligible payroll record enters the processing loop, generating PDF and sending email to real employee email", async () => {
    vi.mocked(pdfService.generatePayslipPdf).mockResolvedValue(
      "https://storage.local/payslip/EMP002.pdf"
    );
    vi.mocked(emailService.sendPayslipEmail).mockResolvedValue("brevo-msg-123");

    const upsertDocMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertEmailMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateItemMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "month") {
                return Promise.resolve({
                  data: [{ id: "run-1", status: "calculated" }],
                  error: null,
                });
              }
              return mockSupabase.from("payroll_runs");
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
                  id: "item-2",
                  payroll_run_id: "run-1",
                  employee_id: "emp-202",
                  employee_name_snapshot: "Sarah Connor",
                  employee_number_snapshot: "EMP002",
                  employee_email_snapshot: "sarah.connor@sky.net",
                  gross_pay: 90000,
                  net_pay: 82000,
                  error_message: null,
                  payslip_documents: [],
                  email_deliveries: [],
                },
              ],
              error: null,
            }),
            update: updateItemMock,
          };
        }
        if (table === "employees") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: "sarah.connor@sky.net" },
              error: null,
            }),
          };
        }
        if (table === "payslip_documents") {
          return { upsert: upsertDocMock };
        }
        if (table === "email_deliveries") {
          return { insert: insertEmailMock };
        }
        return {};
      }),
    };

    const job = startProcessing(2026, 8, mockSupabase as unknown as SupabaseClient);
    await new Promise((r) => setTimeout(r, 100));

    expect(pdfService.generatePayslipPdf).toHaveBeenCalledWith("emp-202", 2026, 8);
    expect(emailService.sendPayslipEmail).toHaveBeenCalledWith(
      "emp-202",
      "Sarah Connor",
      "EMP002",
      "https://storage.local/payslip/EMP002.pdf",
      "sarah.connor@sky.net",
      expect.anything()
    );
    expect(upsertDocMock).toHaveBeenCalled();
    expect(insertEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_email: "sarah.connor@sky.net",
      })
    );

    const status = getJobStatus(job.jobId);
    expect(status?.status).toBe("completed");
  });

  it("4. Database query failures are reported as errors, not empty results", async () => {
    const mockSupabase = {
      from: vi.fn((table?: string) => {
        void table;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string) => {
            if (field === "month") {
              return Promise.resolve({
                data: null,
                error: { message: "Connection to database failed" },
              });
            }
            return mockSupabase.from("payroll_runs");
          }),
        };
      }),
    };

    await expect(
      getPayrollRows(2026, 9, mockSupabase as unknown as SupabaseClient)
    ).rejects.toThrow("Failed to retrieve payroll runs: Connection to database failed");

    const job = startProcessing(2026, 9, mockSupabase as unknown as SupabaseClient);
    await new Promise((r) => setTimeout(r, 50));
    const status = getJobStatus(job.jobId);
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("Connection to database failed");
  });

  it("5. Already-generated PDFs and successfully sent emails are not unnecessarily duplicated", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "month") {
                return Promise.resolve({
                  data: [{ id: "run-done", status: "completed" }],
                  error: null,
                });
              }
              return mockSupabase.from("payroll_runs");
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
                  id: "item-already-done",
                  payroll_run_id: "run-done",
                  employee_id: "emp-done",
                  employee_name_snapshot: "Already Done",
                  employee_number_snapshot: "EMP999",
                  employee_email_snapshot: "done@company.com",
                  gross_pay: 100000,
                  net_pay: 90000,
                  payslip_documents: [
                    {
                      id: "doc-999",
                      storage_path: "payslips/EMP999.pdf",
                      status: "generated",
                    },
                  ],
                  email_deliveries: [
                    {
                      id: "email-999",
                      delivery_status: "sent",
                      recipient_email: "done@company.com",
                    },
                  ],
                },
              ],
              error: null,
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const job = startProcessing(2026, 5, mockSupabase as unknown as SupabaseClient);
    await new Promise((r) => setTimeout(r, 50));

    expect(pdfService.generatePayslipPdf).not.toHaveBeenCalled();
    expect(emailService.sendPayslipEmail).not.toHaveBeenCalled();

    const status = getJobStatus(job.jobId);
    expect(status?.status).toBe("completed");
  });

  it("6. retryPdf and retryEmail re-attempt failed actions and persist status with real email", async () => {
    vi.mocked(pdfService.generatePayslipPdf).mockResolvedValue(
      "https://storage.local/payslip/retry.pdf"
    );
    vi.mocked(emailService.sendPayslipEmail).mockResolvedValue("retry-msg-789");

    const upsertDocMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertEmailMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateItemMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "month") {
                return Promise.resolve({
                  data: [{ id: "run-retry", status: "completed" }],
                  error: null,
                });
              }
              return mockSupabase.from("payroll_runs");
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
                  id: "item-retry-1",
                  payroll_run_id: "run-retry",
                  employee_id: "emp-retry-1",
                  employee_name_snapshot: "Retry User",
                  employee_number_snapshot: "EMP007",
                  employee_email_snapshot: "retry.user@company.com",
                  gross_pay: 50000,
                  net_pay: 45000,
                  payslip_documents: [],
                  email_deliveries: [],
                },
              ],
              error: null,
            }),
            update: updateItemMock,
          };
        }
        if (table === "payslip_documents") {
          return { upsert: upsertDocMock };
        }
        if (table === "email_deliveries") {
          return { insert: insertEmailMock };
        }
        return {};
      }),
    };

    // Retry PDF
    await retryPdf("item-retry-1", 2026, 6, mockSupabase as unknown as SupabaseClient);
    expect(pdfService.generatePayslipPdf).toHaveBeenCalledWith("emp-retry-1", 2026, 6);
    expect(upsertDocMock).toHaveBeenCalled();

    // Now test retryEmail when PDF exists
    const mockSupabaseWithPdf = {
      from: vi.fn((table: string) => {
        if (table === "payroll_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string) => {
              if (field === "month") {
                return Promise.resolve({
                  data: [{ id: "run-retry", status: "completed" }],
                  error: null,
                });
              }
              return mockSupabaseWithPdf.from("payroll_runs");
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
                  id: "item-retry-1",
                  payroll_run_id: "run-retry",
                  employee_id: "emp-retry-1",
                  employee_name_snapshot: "Retry User",
                  employee_number_snapshot: "EMP007",
                  employee_email_snapshot: "retry.user@company.com",
                  gross_pay: 50000,
                  net_pay: 45000,
                  payslip_documents: [
                    {
                      id: "doc-1",
                      storage_path: "payslips/EMP007_2026-06.pdf",
                      status: "generated",
                    },
                  ],
                  email_deliveries: [],
                },
              ],
              error: null,
            }),
            update: updateItemMock,
          };
        }
        if (table === "employees") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: "retry.user@company.com" },
              error: null,
            }),
          };
        }
        if (table === "payslip_documents") {
          return { upsert: upsertDocMock };
        }
        if (table === "email_deliveries") {
          return { insert: insertEmailMock };
        }
        return {};
      }),
    };

    await retryEmail("emp-retry-1", 2026, 6, mockSupabaseWithPdf as unknown as SupabaseClient);
    expect(emailService.sendPayslipEmail).toHaveBeenCalledWith(
      "emp-retry-1",
      "Retry User",
      "EMP007",
      "payslips/EMP007_2026-06.pdf",
      "retry.user@company.com",
      expect.anything()
    );
    expect(insertEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_email: "retry.user@company.com",
      })
    );
  });
});
