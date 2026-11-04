import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPayslipEmail } from "@/lib/brevoEmailService";

const { mockSendTransacEmail } = vi.hoisted(() => ({
  mockSendTransacEmail: vi.fn(),
}));

vi.mock("@getbrevo/brevo", () => ({
  BrevoClient: vi.fn().mockImplementation(() => ({
    transactionalEmails: {
      sendTransacEmail: mockSendTransacEmail,
    },
  })),
}));

describe("brevoEmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries actual email from Supabase employees table when recipientEmail is not provided", async () => {
    mockSendTransacEmail.mockResolvedValue({ messageId: "msg-real-123" });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe("employees");
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string, val: string) => {
            expect(field).toBe("id");
            expect(val).toBe("emp-uuid-1");
            return {
              maybeSingle: vi.fn().mockResolvedValue({
                data: { email: "actual.worker@company.com" },
                error: null,
              }),
            };
          }),
        };
      }),
    };

    const messageId = await sendPayslipEmail(
      "emp-uuid-1",
      "Alice Walker",
      "EMP099",
      "https://storage.supabase.co/payslips/EMP099.pdf",
      null,
      mockSupabase as unknown as SupabaseClient
    );

    expect(messageId).toBe("msg-real-123");
    expect(mockSupabase.from).toHaveBeenCalledWith("employees");
    expect(mockSendTransacEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: "actual.worker@company.com", name: "Alice Walker" }],
        subject: "Your Monthly Payslip",
      })
    );
  });

  it("uses provided recipientEmail directly without fallback to @example.com", async () => {
    mockSendTransacEmail.mockResolvedValue({ messageId: "msg-direct-456" });

    const mockSupabase = {
      from: vi.fn(),
    };

    const messageId = await sendPayslipEmail(
      "emp-uuid-2",
      "Bob Dylan",
      "EMP100",
      "https://storage.supabase.co/payslips/EMP100.pdf",
      "bob.dylan@musicians.org",
      mockSupabase as unknown as SupabaseClient
    );

    expect(messageId).toBe("msg-direct-456");
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockSendTransacEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: "bob.dylan@musicians.org", name: "Bob Dylan" }],
      })
    );
  });

  it("throws error when email is not found in Supabase employees table instead of sending to @example.com", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      })),
    };

    await expect(
      sendPayslipEmail(
        "emp-uuid-3",
        "Ghost Employee",
        "EMP999",
        "https://storage.supabase.co/payslips/EMP999.pdf",
        null,
        mockSupabase as unknown as SupabaseClient
      )
    ).rejects.toThrow(/No email address found in database for employee Ghost Employee/);

    expect(mockSendTransacEmail).not.toHaveBeenCalled();
  });
});
