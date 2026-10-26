import { describe, it, expect } from "vitest";
import {
  validateCreateEmployeeInput,
  validateUpdateEmployeeInput,
  validateSetEmployeeStatusInput,
} from "@/features/employees/validation";

describe("Employee management validation", () => {
  const validCreate = {
    employeeNumber: "EMP-001",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    designation: "Engineer",
    epfNumber: "EPF-100",
    status: "active",
    basicSalary: 100000,
    allowances: 15000,
    variablePayAmount: 0,
  };

  describe("validateCreateEmployeeInput", () => {
    it("accepts a complete valid payload", () => {
      const result = validateCreateEmployeeInput(validCreate);
      expect(result.success).toBe(true);
      expect(result.data?.employeeNumber).toBe("EMP-001");
      expect(result.data?.basicSalary).toBe(100000);
      expect(result.data?.epfNumber).toBe("EPF-100");
    });

    it("rejects missing required identity fields", () => {
      const result = validateCreateEmployeeInput({
        employeeNumber: "",
        fullName: "",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
      expect(result.errors?.employeeNumber).toBeDefined();
      expect(result.errors?.fullName).toBeDefined();
      expect(result.errors?.email).toBeDefined();
    });

    it("rejects negative salary amounts", () => {
      const result = validateCreateEmployeeInput({
        ...validCreate,
        basicSalary: -1,
        allowances: -5,
      });
      expect(result.success).toBe(false);
      expect(result.errors?.basicSalary).toBeDefined();
    });

    it("rejects termination date earlier than hire date", () => {
      const result = validateCreateEmployeeInput({
        ...validCreate,
        hireDate: "2024-06-01",
        terminationDate: "2024-01-01",
      });
      expect(result.success).toBe(false);
      expect(result.errors?.terminationDate).toBeDefined();
    });

    it("coerces numeric string money fields", () => {
      const result = validateCreateEmployeeInput({
        ...validCreate,
        basicSalary: "25000.50",
        allowances: "1000",
      });
      expect(result.success).toBe(true);
      expect(result.data?.basicSalary).toBe(25000.5);
      expect(result.data?.allowances).toBe(1000);
    });
  });

  describe("validateUpdateEmployeeInput", () => {
    it("allows partial updates", () => {
      const result = validateUpdateEmployeeInput({
        fullName: "Updated Name",
        basicSalary: 120000,
      });
      expect(result.success).toBe(true);
      expect(result.data?.fullName).toBe("Updated Name");
      expect(result.data?.basicSalary).toBe(120000);
    });

    it("normalizes blank optional strings to null", () => {
      const result = validateUpdateEmployeeInput({
        designation: "   ",
        epfNumber: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.designation).toBeNull();
      expect(result.data?.epfNumber).toBeNull();
    });

    it("rejects invalid email on update", () => {
      const result = validateUpdateEmployeeInput({ email: "bad" });
      expect(result.success).toBe(false);
      expect(result.errors?.email).toBeDefined();
    });
  });

  describe("validateSetEmployeeStatusInput", () => {
    it("accepts active/inactive with a valid UUID", () => {
      const result = validateSetEmployeeStatusInput({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "inactive",
      });
      expect(result.success).toBe(true);
    });

    it("rejects terminated as a toggle status", () => {
      const result = validateSetEmployeeStatusInput({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "terminated",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID", () => {
      const result = validateSetEmployeeStatusInput({
        id: "not-a-uuid",
        status: "active",
      });
      expect(result.success).toBe(false);
      expect(result.errors?.id).toBeDefined();
    });
  });
});
