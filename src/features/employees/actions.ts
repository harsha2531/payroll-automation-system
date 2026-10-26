"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth.service";
import { EmployeeService } from "@/services/employee.service";
import type { Employee, EmployeeWithPayrollDetails } from "@/types/payroll";
import {
  validateCreateEmployeeInput,
  validateSetEmployeeStatusInput,
  validateUpdateEmployeeInput,
} from "./validation";

export interface EmployeeActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  const str = String(value);
  return str;
}

function parseOptionalMoney(
  value: FormDataEntryValue | null
): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Ensures the caller is an authenticated admin.
 * Returns an action error instead of redirecting so forms can show a message.
 */
async function requireAdminForAction<T = never>(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; result: EmployeeActionResult<T> }
> {
  const supabase = await createClient();
  const { user, profile, isAdmin } =
    await AuthService.getCurrentUserWithProfile(supabase);

  if (!user || !profile) {
    return {
      ok: false,
      result: {
        success: false,
        error: "You must be signed in to manage employees.",
      },
    };
  }

  if (!isAdmin) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Permission denied: Only administrators can manage employees.",
      },
    };
  }

  return { ok: true, supabase };
}

export async function createEmployeeAction(
  formData: Record<string, unknown>
): Promise<EmployeeActionResult<EmployeeWithPayrollDetails>> {
  const auth = await requireAdminForAction<EmployeeWithPayrollDetails>();
  if (!auth.ok) return auth.result;

  const validation = validateCreateEmployeeInput(formData);
  if (!validation.success || !validation.data) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please correct the highlighted errors.",
    };
  }

  const data = validation.data;
  const result = await EmployeeService.create(auth.supabase as never, {
    employeeNumber: data.employeeNumber,
    fullName: data.fullName,
    email: data.email,
    designation: data.designation ?? null,
    department: data.department ?? null,
    phone: data.phone ?? null,
    epfNumber: data.epfNumber ?? null,
    status: data.status,
    hireDate: data.hireDate ?? null,
    terminationDate: data.terminationDate ?? null,
    payrollDetails: {
      basicSalary: data.basicSalary,
      allowances: data.allowances,
      variablePayLabel: data.variablePayLabel ?? null,
      variablePayAmount: data.variablePayAmount,
      notes: data.payrollNotes ?? null,
      effectiveFrom: data.effectiveFrom ?? null,
    },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/employees");
  return { success: true, data: result.data };
}

export async function updateEmployeeAction(
  id: string,
  formData: Record<string, unknown>
): Promise<EmployeeActionResult<EmployeeWithPayrollDetails>> {
  const auth = await requireAdminForAction<EmployeeWithPayrollDetails>();
  if (!auth.ok) return auth.result;

  if (!id || typeof id !== "string") {
    return { success: false, error: "Invalid employee ID." };
  }

  const validation = validateUpdateEmployeeInput(formData);
  if (!validation.success || !validation.data) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please correct the highlighted errors.",
    };
  }

  const data = validation.data;
  const hasPayrollFields =
    data.basicSalary !== undefined ||
    data.allowances !== undefined ||
    data.variablePayAmount !== undefined ||
    data.variablePayLabel !== undefined ||
    data.payrollNotes !== undefined ||
    data.effectiveFrom !== undefined;

  const result = await EmployeeService.update(auth.supabase as never, id, {
    employeeNumber: data.employeeNumber,
    fullName: data.fullName,
    email: data.email,
    designation: data.designation,
    department: data.department,
    phone: data.phone,
    epfNumber: data.epfNumber,
    status: data.status,
    hireDate: data.hireDate,
    terminationDate: data.terminationDate,
    payrollDetails: hasPayrollFields
      ? {
          basicSalary: data.basicSalary ?? 0,
          allowances: data.allowances ?? 0,
          variablePayLabel: data.variablePayLabel ?? null,
          variablePayAmount: data.variablePayAmount ?? 0,
          notes: data.payrollNotes ?? null,
          effectiveFrom: data.effectiveFrom ?? null,
        }
      : undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath(`/employees/edit/${id}`);
  return { success: true, data: result.data };
}

export async function setEmployeeStatusAction(
  id: string,
  status: "active" | "inactive"
): Promise<EmployeeActionResult<Employee>> {
  const auth = await requireAdminForAction<Employee>();
  if (!auth.ok) return auth.result;

  const validation = validateSetEmployeeStatusInput({ id, status });
  if (!validation.success || !validation.data) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Invalid status change request.",
    };
  }

  const result = await EmployeeService.setStatus(
    auth.supabase as never,
    validation.data.id,
    validation.data.status
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath(`/employees/edit/${id}`);
  return { success: true, data: result.data };
}

/**
 * Helper for FormData-based submissions from progressive-enhancement forms.
 */
export async function createEmployeeFromFormData(
  formData: FormData
): Promise<EmployeeActionResult<EmployeeWithPayrollDetails>> {
  return createEmployeeAction({
    employeeNumber: emptyToUndefined(formData.get("employeeNumber")),
    fullName: emptyToUndefined(formData.get("fullName")),
    email: emptyToUndefined(formData.get("email")),
    designation: emptyToUndefined(formData.get("designation")),
    department: emptyToUndefined(formData.get("department")),
    phone: emptyToUndefined(formData.get("phone")),
    epfNumber: emptyToUndefined(formData.get("epfNumber")),
    status: emptyToUndefined(formData.get("status")) ?? "active",
    hireDate: emptyToUndefined(formData.get("hireDate")),
    terminationDate: emptyToUndefined(formData.get("terminationDate")),
    basicSalary: parseOptionalMoney(formData.get("basicSalary")) ?? 0,
    allowances: parseOptionalMoney(formData.get("allowances")) ?? 0,
    variablePayLabel: emptyToUndefined(formData.get("variablePayLabel")),
    variablePayAmount: parseOptionalMoney(formData.get("variablePayAmount")) ?? 0,
    payrollNotes: emptyToUndefined(formData.get("payrollNotes")),
    effectiveFrom: emptyToUndefined(formData.get("effectiveFrom")),
  });
}
