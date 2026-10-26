import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUserWithProfile = vi.fn();
const mockBuildPreview = vi.fn();
const mockConfirmImport = vi.fn();
const mockValidateUpload = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn() })),
}));

vi.mock("@/services/auth.service", () => ({
  AuthService: {
    getCurrentUserWithProfile: (...args: unknown[]) =>
      mockGetCurrentUserWithProfile(...args),
  },
}));

vi.mock("@/services/payroll-import.service", () => ({
  PayrollImportService: {
    validateUpload: (...args: unknown[]) => mockValidateUpload(...args),
    buildPreview: (...args: unknown[]) => mockBuildPreview(...args),
    confirmImport: (...args: unknown[]) => mockConfirmImport(...args),
  },
}));

import {
  previewPayrollImportAction,
  confirmPayrollImportAction,
} from "@/features/payroll/import-actions";

const adminSession = {
  user: { id: "admin-1" },
  profile: { id: "admin-1", role: "admin", email: "admin@example.com" },
  isAdmin: true,
};

function xlsxFormData() {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const file = new File([bytes], "july.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

describe("Payroll import server actions — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUpload.mockReturnValue({ success: true });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUserWithProfile.mockResolvedValueOnce({
      user: null,
      profile: null,
      isAdmin: false,
    });

    const result = await previewPayrollImportAction(xlsxFormData());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/signed in/i);
    expect(mockBuildPreview).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers", async () => {
    mockGetCurrentUserWithProfile.mockResolvedValueOnce({
      user: { id: "emp-1" },
      profile: { id: "emp-1", role: "employee" },
      isAdmin: false,
    });

    const result = await confirmPayrollImportAction(xlsxFormData());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/administrators/i);
    expect(mockConfirmImport).not.toHaveBeenCalled();
  });

  it("previews for administrators", async () => {
    mockGetCurrentUserWithProfile.mockResolvedValueOnce(adminSession);
    mockBuildPreview.mockResolvedValueOnce({
      success: true,
      data: { rows: [], counts: { importable: 0, skipped: 0, rejected: 0, willUpdate: 0 } },
    });

    const result = await previewPayrollImportAction(xlsxFormData());
    expect(result.success).toBe(true);
    expect(mockBuildPreview).toHaveBeenCalledOnce();
  });
});
