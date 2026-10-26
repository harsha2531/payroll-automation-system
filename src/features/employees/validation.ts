import { z } from "zod";
import {
  employeeStatusSchema,
  validateInput,
  type ValidationResult,
} from "@/features/payroll/validation";

export { employeeStatusSchema, validateInput };
export type { ValidationResult };

/** Accepts string | null | undefined; blank strings become null. */
const optionalTrimmed = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(100).nullable().optional());

const optionalDate = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .nullable()
  .optional());

const nonNegativeMoney = z.coerce
  .number({ message: "Amount must be a number" })
  .min(0, "Amount must be non-negative")
  .finite("Amount must be a finite number");

export const employeePayrollDetailsSchema = z.object({
  basicSalary: nonNegativeMoney,
  allowances: nonNegativeMoney.default(0),
  variablePayLabel: z
    .string()
    .trim()
    .max(100, "Variable pay label must not exceed 100 characters")
    .nullable()
    .optional(),
  variablePayAmount: nonNegativeMoney.default(0),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must not exceed 2000 characters")
    .nullable()
    .optional(),
  effectiveFrom: optionalDate,
});

export const createEmployeeFormSchema = z
  .object({
    employeeNumber: z
      .string()
      .trim()
      .min(1, "Employee number is required")
      .max(50, "Employee number must not exceed 50 characters"),
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(200, "Full name must not exceed 200 characters"),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(255, "Email must not exceed 255 characters"),
    designation: z
      .string()
      .trim()
      .max(100, "Designation must not exceed 100 characters")
      .nullable()
      .optional(),
    department: z
      .string()
      .trim()
      .max(100, "Department must not exceed 100 characters")
      .nullable()
      .optional(),
    phone: z
      .string()
      .trim()
      .max(50, "Phone number must not exceed 50 characters")
      .nullable()
      .optional(),
    epfNumber: z
      .string()
      .trim()
      .max(50, "EPF number must not exceed 50 characters")
      .nullable()
      .optional(),
    status: employeeStatusSchema.default("active"),
    hireDate: optionalDate,
    terminationDate: optionalDate,
    // Current payroll defaults (optional on create; zeros allowed)
    basicSalary: nonNegativeMoney.default(0),
    allowances: nonNegativeMoney.default(0),
    variablePayLabel: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional(),
    variablePayAmount: nonNegativeMoney.default(0),
    payrollNotes: z.string().trim().max(2000).nullable().optional(),
    effectiveFrom: optionalDate,
  })
  .refine(
    (data) => {
      if (data.hireDate && data.terminationDate) {
        return data.terminationDate >= data.hireDate;
      }
      return true;
    },
    {
      message: "Termination date cannot be earlier than hire date",
      path: ["terminationDate"],
    }
  );

export const updateEmployeeFormSchema = z
  .object({
    employeeNumber: z
      .string()
      .trim()
      .min(1, "Employee number cannot be empty")
      .max(50)
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(1, "Full name cannot be empty")
      .max(200)
      .optional(),
    email: z.string().trim().email("Invalid email address").max(255).optional(),
    designation: optionalTrimmed,
    department: optionalTrimmed,
    phone: optionalTrimmed,
    epfNumber: optionalTrimmed,
    status: employeeStatusSchema.optional(),
    hireDate: optionalDate,
    terminationDate: optionalDate,
    basicSalary: nonNegativeMoney.optional(),
    allowances: nonNegativeMoney.optional(),
    variablePayLabel: optionalTrimmed,
    variablePayAmount: nonNegativeMoney.optional(),
    payrollNotes: optionalTrimmed,
    effectiveFrom: optionalDate,
  })
  .refine(
    (data) => {
      if (data.hireDate && data.terminationDate) {
        return data.terminationDate >= data.hireDate;
      }
      return true;
    },
    {
      message: "Termination date cannot be earlier than hire date",
      path: ["terminationDate"],
    }
  );

export const setEmployeeStatusSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
  status: z.enum(["active", "inactive"], {
    message: "Status must be active or inactive",
  }),
});

export const employeeIdSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
});

export type CreateEmployeeFormInput = z.infer<typeof createEmployeeFormSchema>;
export type UpdateEmployeeFormInput = z.infer<typeof updateEmployeeFormSchema>;

export function validateCreateEmployeeInput(
  input: unknown
): ValidationResult<CreateEmployeeFormInput> {
  return validateInput(createEmployeeFormSchema, input);
}

export function validateUpdateEmployeeInput(
  input: unknown
): ValidationResult<UpdateEmployeeFormInput> {
  return validateInput(updateEmployeeFormSchema, input);
}

export function validateSetEmployeeStatusInput(
  input: unknown
): ValidationResult<z.infer<typeof setEmployeeStatusSchema>> {
  return validateInput(setEmployeeStatusSchema, input);
}
