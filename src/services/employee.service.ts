import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  Employee,
  EmployeePayrollDetails,
  EmployeeStatus,
  EmployeeWithPayrollDetails,
} from "@/types/payroll";
import { Result, type PaginatedResult } from "@/types/common";
import {
  EmployeeRepository,
  type CreateEmployeeInput,
  type ListEmployeesFilters,
  type UpdateEmployeeInput,
  type UpsertEmployeePayrollDetailsInput,
} from "@/repositories/employee.repository";

export interface CreateEmployeeWithDetailsInput extends CreateEmployeeInput {
  payrollDetails?: UpsertEmployeePayrollDetailsInput;
}

export interface UpdateEmployeeWithDetailsInput extends UpdateEmployeeInput {
  payrollDetails?: UpsertEmployeePayrollDetailsInput;
}

/**
 * Employee management orchestration.
 * Keeps master identity updates separate from current compensation defaults,
 * and never writes to monthly payroll_items (historical snapshots).
 */
export const EmployeeService = {
  async list(
    supabase: SupabaseClient<Database>,
    filters: ListEmployeesFilters
  ): Promise<Result<PaginatedResult<Employee>>> {
    return EmployeeRepository.listEmployees(supabase, filters);
  },

  async getById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<EmployeeWithPayrollDetails | null> {
    return EmployeeRepository.findWithPayrollDetails(supabase, id);
  },

  /**
   * Creates an employee and optionally seeds current payroll defaults.
   */
  async create(
    supabase: SupabaseClient<Database>,
    input: CreateEmployeeWithDetailsInput
  ): Promise<Result<EmployeeWithPayrollDetails>> {
    const created = await EmployeeRepository.createEmployee(supabase, input);
    if (!created.success) return created;

    let payrollDetails: EmployeePayrollDetails | null = null;

    if (input.payrollDetails) {
      const details = await EmployeeRepository.upsertPayrollDetails(
        supabase,
        created.data.id,
        input.payrollDetails
      );
      if (!details.success) {
        return Result.err(details.error);
      }
      payrollDetails = details.data;
    }

    return Result.ok({ ...created.data, payrollDetails });
  },

  /**
   * Updates master employee fields and/or current payroll defaults.
   * Does not modify payroll_items rows.
   */
  async update(
    supabase: SupabaseClient<Database>,
    id: string,
    input: UpdateEmployeeWithDetailsInput
  ): Promise<Result<EmployeeWithPayrollDetails>> {
    const existing = await EmployeeRepository.findById(supabase, id);
    if (!existing) {
      return Result.err("Employee not found.");
    }

    const {
      payrollDetails: payrollInput,
      ...employeeFields
    } = input;

    const hasEmployeeFields = Object.keys(employeeFields).length > 0;
    let employee = existing;

    if (hasEmployeeFields) {
      const updated = await EmployeeRepository.updateEmployee(
        supabase,
        id,
        employeeFields
      );
      if (!updated.success) return updated;
      employee = updated.data;
    }

    let payrollDetails =
      await EmployeeRepository.findPayrollDetailsByEmployeeId(supabase, id);

    if (payrollInput) {
      const details = await EmployeeRepository.upsertPayrollDetails(
        supabase,
        id,
        payrollInput
      );
      if (!details.success) {
        return Result.err(details.error);
      }
      payrollDetails = details.data;
    }

    return Result.ok({ ...employee, payrollDetails });
  },

  /**
   * Activates or deactivates an employee without touching compensation history.
   */
  async setStatus(
    supabase: SupabaseClient<Database>,
    id: string,
    status: Extract<EmployeeStatus, "active" | "inactive">
  ): Promise<Result<Employee>> {
    const existing = await EmployeeRepository.findById(supabase, id);
    if (!existing) {
      return Result.err("Employee not found.");
    }

    return EmployeeRepository.updateEmployee(supabase, id, { status });
  },
};
