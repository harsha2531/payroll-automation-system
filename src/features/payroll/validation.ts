import { z } from "zod";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !errors[path]) {
      errors[path] = issue.message;
    } else if (!errors["_global"]) {
      errors["_global"] = issue.message;
    }
  }
  return errors;
}

// ==============================================================================
// 1. EMPLOYEE SCHEMAS
// ==============================================================================

export const employeeStatusSchema = z.enum([
  "active",
  "inactive",
  "terminated",
  "on_leave",
]);

export const createEmployeeSchema = z
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
      .optional()
      .nullable(),
    department: z
      .string()
      .trim()
      .max(100, "Department must not exceed 100 characters")
      .optional()
      .nullable(),
    phone: z
      .string()
      .trim()
      .max(50, "Phone number must not exceed 50 characters")
      .optional()
      .nullable(),
    epfNumber: z
      .string()
      .trim()
      .max(50, "EPF number must not exceed 50 characters")
      .optional()
      .nullable(),
    status: employeeStatusSchema.default("active"),
    hireDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date must be in YYYY-MM-DD format")
      .optional()
      .nullable(),
    terminationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Termination date must be in YYYY-MM-DD format")
      .optional()
      .nullable(),
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

export const updateEmployeeSchema = z
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
    designation: z.string().trim().max(100).optional().nullable(),
    department: z.string().trim().max(100).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    epfNumber: z.string().trim().max(50).optional().nullable(),
    status: employeeStatusSchema.optional(),
    hireDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date must be in YYYY-MM-DD format")
      .optional()
      .nullable(),
    terminationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Termination date must be in YYYY-MM-DD format")
      .optional()
      .nullable(),
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

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: employeeStatusSchema.optional(),
  search: z.string().trim().optional(),
});

// ==============================================================================
// 2. PAYROLL RUN SCHEMAS
// ==============================================================================

export const payrollRunStatusSchema = z.enum([
  "draft",
  "processing",
  "calculated",
  "approved",
  "completed",
  "failed",
  "cancelled",
]);

export const payrollRunTypeSchema = z.enum([
  "regular",
  "supplementary",
  "correction",
  "bonus",
]);

export const createPayrollRunSchema = z.object({
  year: z
    .number()
    .int("Year must be an integer")
    .min(2000, "Year must be 2000 or later")
    .max(2100, "Year must be 2100 or earlier"),
  month: z
    .number()
    .int("Month must be an integer")
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12"),
  sequenceNumber: z
    .number()
    .int("Sequence number must be an integer")
    .min(1, "Sequence number must be at least 1")
    .default(1),
  runType: payrollRunTypeSchema.default("regular"),
  notes: z
    .string()
    .max(1000, "Notes must not exceed 1000 characters")
    .optional()
    .nullable(),
  sourceFilename: z
    .string()
    .max(255, "Source filename must not exceed 255 characters")
    .optional()
    .nullable(),
  importMetadata: z.record(z.string(), z.unknown()).default({}),
});

export const updatePayrollRunStatusSchema = z.object({
  status: payrollRunStatusSchema,
  notes: z.string().max(1000).optional().nullable(),
  errorMessage: z.string().max(2000).optional().nullable(),
});

export const payrollRunQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: payrollRunStatusSchema.optional(),
});

// ==============================================================================
// 3. PAYROLL ITEM SCHEMAS
// ==============================================================================

export const createPayrollItemSchema = z.object({
  payrollRunId: z.string().uuid("Invalid payroll run ID"),
  employeeId: z.string().uuid("Invalid employee ID"),
  employeeNumberSnapshot: z.string().trim().min(1, "Employee number snapshot required"),
  employeeNameSnapshot: z.string().trim().min(1, "Employee name snapshot required"),
  employeeEmailSnapshot: z.string().trim().email("Invalid snapshot email"),
  designationSnapshot: z.string().trim().nullable().optional(),
  departmentSnapshot: z.string().trim().nullable().optional(),
  basicSalary: z
    .number()
    .min(0, "Basic salary must be non-negative"),
  variablePayLabel: z
    .string()
    .trim()
    .max(100, "Variable pay label must not exceed 100 characters")
    .nullable()
    .optional(),
  variablePayAmount: z
    .number()
    .min(0, "Variable pay amount must be non-negative")
    .default(0),
  allowances: z
    .number()
    .min(0, "Allowances must be non-negative")
    .default(0),
  grossPay: z
    .number()
    .min(0, "Gross pay must be non-negative"),
  totalDeductions: z
    .number()
    .min(0, "Total deductions must be non-negative")
    .default(0),
  employerContributions: z
    .number()
    .min(0, "Employer contributions must be non-negative")
    .default(0),
  netPay: z
    .number()
    .min(0, "Net pay must be non-negative"),
  earningsBreakdown: z.record(z.string(), z.unknown()).default({}),
  deductionsBreakdown: z.record(z.string(), z.unknown()).default({}),
  calculationMetadata: z.record(z.string(), z.unknown()).default({}),
});

export const updatePayrollItemSchema = createPayrollItemSchema.partial();

// ==============================================================================
// 4. PAYSLIP DOCUMENT SCHEMAS
// ==============================================================================

export const payslipDocumentStatusSchema = z.enum([
  "pending",
  "generated",
  "failed",
]);

export const createPayslipDocumentSchema = z.object({
  payrollItemId: z.string().uuid("Invalid payroll item ID"),
  payrollRunId: z.string().uuid("Invalid payroll run ID"),
  storageBucket: z.string().trim().min(1).default("payslips"),
  storagePath: z.string().trim().min(1, "Storage path is required"),
  fileName: z.string().trim().min(1, "File name is required"),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  fileHash: z.string().trim().nullable().optional(),
  mimeType: z.string().trim().default("application/pdf"),
  status: payslipDocumentStatusSchema.default("pending"),
});

export const updatePayslipDocumentStatusSchema = z.object({
  status: payslipDocumentStatusSchema,
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  fileHash: z.string().trim().optional().nullable(),
  errorMessage: z.string().max(2000).optional().nullable(),
  generatedAt: z.string().datetime().optional().nullable(),
});

// ==============================================================================
// 5. EMAIL DELIVERY SCHEMAS
// ==============================================================================

export const emailDeliveryStatusSchema = z.enum([
  "pending",
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);

export const createEmailDeliverySchema = z.object({
  payrollItemId: z.string().uuid("Invalid payroll item ID"),
  payslipDocumentId: z.string().uuid("Invalid payslip document ID").nullable().optional(),
  recipientEmail: z.string().trim().email("Invalid recipient email"),
  recipientName: z.string().trim().max(200).nullable().optional(),
  deliveryStatus: emailDeliveryStatusSchema.default("pending"),
  provider: z.string().trim().default("brevo"),
  providerMessageId: z.string().trim().nullable().optional(),
  maxAttempts: z.number().int().min(1).default(3),
  idempotencyKey: z.string().trim().min(1, "Idempotency key is required"),
  errorDetails: z.record(z.string(), z.unknown()).default({}),
});

export const updateEmailDeliveryStatusSchema = z.object({
  deliveryStatus: emailDeliveryStatusSchema,
  providerMessageId: z.string().trim().optional().nullable(),
  errorMessage: z.string().max(2000).optional().nullable(),
  errorDetails: z.record(z.string(), z.unknown()).optional(),
  sentAt: z.string().datetime().optional().nullable(),
  lastAttemptAt: z.string().datetime().optional().nullable(),
  nextRetryAt: z.string().datetime().optional().nullable(),
});

// ==============================================================================
// 6. PROCESSING JOB SCHEMAS
// ==============================================================================

export const processingJobTypeSchema = z.enum([
  "payroll_import",
  "payroll_calculation",
  "payslip_pdf_generation",
  "email_dispatch",
  "bulk_email_dispatch",
]);

export const processingJobStatusSchema = z.enum([
  "queued",
  "claimed",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const enqueueProcessingJobSchema = z.object({
  jobType: processingJobTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  maxAttempts: z.number().int().min(1, "Maximum attempts must be at least 1").default(3),
  availableAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(1).nullable().optional(),
});

export const claimProcessingJobSchema = z.object({
  workerId: z.string().trim().min(1, "Worker identifier is required"),
  lockDurationSeconds: z.number().int().min(5).max(3600).default(300),
});

export const completeProcessingJobSchema = z.object({
  result: z.record(z.string(), z.unknown()).default({}),
});

export const failProcessingJobSchema = z.object({
  errorMessage: z.string().max(2000),
  errorDetails: z.record(z.string(), z.unknown()).default({}),
  shouldRetry: z.boolean().default(true),
  backoffSeconds: z.number().int().min(0).default(60),
});

// ==============================================================================
// VALIDATION HELPER FUNCTIONS
// ==============================================================================

export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  }
  return {
    success: true,
    data: result.data,
  };
}
