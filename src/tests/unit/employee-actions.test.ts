import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUserWithProfile = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSetStatus = vi.fn();
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

vi.mock("@/services/employee.service", () => ({
  EmployeeService: {
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    setStatus: (...args: unknown[]) => mockSetStatus(...args),
  },
}));

import {
  createEmployeeAction,
  updateEmployeeAction,
  setEmployeeStatusAction,
} from "@/features/employees/actions";

const adminSession = {
  user: { id: "admin-1" },
  profile: { id: "admin-1", role: "admin", email: "admin@example.com" },
  isAdmin: true,
};

const employeeSession = {
  user: { id: "emp-1" },
  profile: { id: "emp-1", role: "employee", email: "emp@example.com" },
  isAdmin: false,
};

const validPayload = {
  employeeNumber: "EMP-010",
  fullName: "Grace Hopper",
  email: "grace@example.com",
  designation: "Admiral",
  epfNumber: "EPF-010",
  status: "active",
  basicSalary: 90000,
  allowances: 5000,
  variablePayAmount: 0,
};

describe("Employee server actions — authorization & CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization (RLS-sensitive gate)", () => {
    it("rejects unauthenticated callers without touching the service", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce({
        user: null,
        profile: null,
        isAdmin: false,
      });

      const result = await createEmployeeAction(validPayload);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/signed in/i);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects non-admin callers", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce(employeeSession);

      const result = await createEmployeeAction(validPayload);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/administrators/i);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("createEmployeeAction", () => {
    it("returns field errors for invalid input", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce(adminSession);

      const result = await createEmployeeAction({
        employeeNumber: "",
        fullName: "",
        email: "bad",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("creates an employee with payroll defaults for admins", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce(adminSession);
      mockCreate.mockResolvedValueOnce({
        success: true,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          ...validPayload,
          department: null,
          phone: null,
          hireDate: null,
          terminationDate: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          payrollDetails: {
            id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            employeeId: "550e8400-e29b-41d4-a716-446655440000",
            basicSalary: 90000,
            allowances: 5000,
            allowancesBreakdown: {},
            variablePayLabel: null,
            variablePayAmount: 0,
            notes: null,
            effectiveFrom: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        },
      });

      const result = await createEmployeeAction(validPayload);

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledOnce();
      const [, input] = mockCreate.mock.calls[0];
      expect(input.employeeNumber).toBe("EMP-010");
      expect(input.payrollDetails.basicSalary).toBe(90000);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/employees");
    });
  });

  describe("updateEmployeeAction", () => {
    it("updates master fields and current payroll defaults", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce(adminSession);
      mockUpdate.mockResolvedValueOnce({
        success: true,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          employeeNumber: "EMP-010",
          fullName: "Grace M. Hopper",
          email: "grace@example.com",
          designation: "Admiral",
          department: null,
          phone: null,
          epfNumber: "EPF-010",
          status: "active",
          hireDate: null,
          terminationDate: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          payrollDetails: {
            id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            employeeId: "550e8400-e29b-41d4-a716-446655440000",
            basicSalary: 95000,
            allowances: 5000,
            allowancesBreakdown: {},
            variablePayLabel: null,
            variablePayAmount: 0,
            notes: null,
            effectiveFrom: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        },
      });

      const result = await updateEmployeeAction(
        "550e8400-e29b-41d4-a716-446655440000",
        { fullName: "Grace M. Hopper", basicSalary: 95000, allowances: 5000 }
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledOnce();
      const [, id, input] = mockUpdate.mock.calls[0];
      expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(input.fullName).toBe("Grace M. Hopper");
      expect(input.payrollDetails.basicSalary).toBe(95000);
    });
  });

  describe("setEmployeeStatusAction", () => {
    it("activates or deactivates an employee", async () => {
      mockGetCurrentUserWithProfile.mockResolvedValueOnce(adminSession);
      mockSetStatus.mockResolvedValueOnce({
        success: true,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          employeeNumber: "EMP-010",
          fullName: "Grace Hopper",
          email: "grace@example.com",
          designation: null,
          department: null,
          phone: null,
          epfNumber: null,
          status: "inactive",
          hireDate: null,
          terminationDate: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      });

      const result = await setEmployeeStatusAction(
        "550e8400-e29b-41d4-a716-446655440000",
        "inactive"
      );

      expect(result.success).toBe(true);
      expect(mockSetStatus).toHaveBeenCalledWith(
        expect.anything(),
        "550e8400-e29b-41d4-a716-446655440000",
        "inactive"
      );
    });
  });
});
