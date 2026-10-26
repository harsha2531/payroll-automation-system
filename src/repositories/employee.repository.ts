import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type {
  Employee,
  EmployeePayrollDetails,
  EmployeeStatus,
  EmployeeWithPayrollDetails,
} from "@/types/payroll";
import { Result, type PaginationParams, type PaginatedResult } from "@/types/common";
import { mapDatabaseError } from "./errors";

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

type PayrollDetailsRow =
  Database["public"]["Tables"]["employee_payroll_details"]["Row"];
type PayrollDetailsInsert =
  Database["public"]["Tables"]["employee_payroll_details"]["Insert"];
type PayrollDetailsUpdate =
  Database["public"]["Tables"]["employee_payroll_details"]["Update"];

const EMPLOYEE_SELECT =
  "id, employee_number, full_name, email, designation, department, phone, epf_number, status, hire_date, termination_date, created_at, updated_at";

const PAYROLL_DETAILS_SELECT =
  "id, employee_id, basic_salary, allowances, allowances_breakdown, variable_pay_label, variable_pay_amount, notes, effective_from, created_at, updated_at";

export function mapEmployeeRowToDomain(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    email: row.email,
    designation: row.designation,
    department: row.department,
    phone: row.phone,
    epfNumber: row.epf_number,
    status: row.status,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEmployeePayrollDetailsRowToDomain(
  row: PayrollDetailsRow
): EmployeePayrollDetails {
  return {
    id: row.id,
    employeeId: row.employee_id,
    basicSalary: Number(row.basic_salary),
    allowances: Number(row.allowances),
    allowancesBreakdown:
      (row.allowances_breakdown as Record<string, unknown>) ?? {},
    variablePayLabel: row.variable_pay_label,
    variablePayAmount: Number(row.variable_pay_amount),
    notes: row.notes,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListEmployeesFilters extends PaginationParams {
  status?: EmployeeStatus;
  search?: string;
}

export interface CreateEmployeeInput {
  employeeNumber: string;
  fullName: string;
  email: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  epfNumber?: string | null;
  status?: EmployeeStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
}

export type UpdateEmployeeInput = Partial<{
  employeeNumber: string;
  fullName: string;
  email: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  epfNumber: string | null;
  status: EmployeeStatus;
  hireDate: string | null;
  terminationDate: string | null;
}>;

export interface UpsertEmployeePayrollDetailsInput {
  basicSalary: number;
  allowances?: number;
  allowancesBreakdown?: Record<string, unknown>;
  variablePayLabel?: string | null;
  variablePayAmount?: number;
  notes?: string | null;
  effectiveFrom?: string | null;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const EmployeeRepository = {
  /**
   * Fetches an employee record by UUID.
   */
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(EMPLOYEE_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error || !data) return null;
      return mapEmployeeRowToDomain(data);
    } catch {
      return null;
    }
  },

  /**
   * Fetches an employee record by employee number (code).
   */
  async findByEmployeeNumber(
    supabase: SupabaseClient<Database>,
    employeeNumber: string
  ): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(EMPLOYEE_SELECT)
        .eq("employee_number", employeeNumber.trim())
        .maybeSingle();

      if (error || !data) return null;
      return mapEmployeeRowToDomain(data);
    } catch {
      return null;
    }
  },

  /**
   * Fetches an employee record by email address.
   */
  async findByEmail(
    supabase: SupabaseClient<Database>,
    email: string
  ): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(EMPLOYEE_SELECT)
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) return null;
      return mapEmployeeRowToDomain(data);
    } catch {
      return null;
    }
  },

  /**
   * Fetches an employee by EPF number when present.
   */
  async findByEpfNumber(
    supabase: SupabaseClient<Database>,
    epfNumber: string
  ): Promise<Employee | null> {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(EMPLOYEE_SELECT)
        .eq("epf_number", epfNumber.trim())
        .maybeSingle();

      if (error || !data) return null;
      return mapEmployeeRowToDomain(data);
    } catch {
      return null;
    }
  },

  /**
   * Retrieves a paginated list of employees with optional status and search filters.
   */
  async listEmployees(
    supabase: SupabaseClient<Database>,
    filters: ListEmployeesFilters
  ): Promise<Result<PaginatedResult<Employee>>> {
    try {
      const page = Math.max(1, filters.page || 1);
      const pageSize = Math.max(1, Math.min(100, filters.pageSize || 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("employees")
        .select(EMPLOYEE_SELECT, { count: "exact" });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      if (filters.search) {
        const term = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${term}%,employee_number.ilike.%${term}%,email.ilike.%${term}%,epf_number.ilike.%${term}%`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return Result.err(mapDatabaseError(error, "Failed to retrieve employees."));
      }

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      return Result.ok({
        items: (data || []).map(mapEmployeeRowToDomain),
        total,
        page,
        pageSize,
        totalPages,
      });
    } catch (err) {
      return Result.err(mapDatabaseError(err, "Unexpected error retrieving employees."));
    }
  },

  /**
   * Inserts a new employee record.
   */
  async createEmployee(
    supabase: SupabaseClient<Database>,
    input: CreateEmployeeInput
  ): Promise<Result<Employee>> {
    try {
      const payload: EmployeeInsert = {
        employee_number: input.employeeNumber.trim(),
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        designation: emptyToNull(input.designation),
        department: emptyToNull(input.department),
        phone: emptyToNull(input.phone),
        epf_number: emptyToNull(input.epfNumber),
        status: input.status || "active",
        hire_date: input.hireDate || null,
        termination_date: input.terminationDate || null,
      };

      const { data, error } = await supabase
        .from("employees")
        .insert(payload)
        .select(EMPLOYEE_SELECT)
        .single();

      if (error || !data) {
        return Result.err(mapDatabaseError(error, "Failed to create employee."));
      }

      return Result.ok(mapEmployeeRowToDomain(data));
    } catch (err) {
      return Result.err(mapDatabaseError(err, "Unexpected error creating employee."));
    }
  },

  /**
   * Updates an existing employee record (master identity/details only).
   * Does not modify payroll_items or employee_payroll_details.
   */
  async updateEmployee(
    supabase: SupabaseClient<Database>,
    id: string,
    input: UpdateEmployeeInput
  ): Promise<Result<Employee>> {
    try {
      const payload: EmployeeUpdate = {};

      if (input.employeeNumber !== undefined) {
        payload.employee_number = input.employeeNumber.trim();
      }
      if (input.fullName !== undefined) {
        payload.full_name = input.fullName.trim();
      }
      if (input.email !== undefined) {
        payload.email = input.email.trim().toLowerCase();
      }
      if (input.designation !== undefined) {
        payload.designation = emptyToNull(input.designation);
      }
      if (input.department !== undefined) {
        payload.department = emptyToNull(input.department);
      }
      if (input.phone !== undefined) {
        payload.phone = emptyToNull(input.phone);
      }
      if (input.epfNumber !== undefined) {
        payload.epf_number = emptyToNull(input.epfNumber);
      }
      if (input.status !== undefined) {
        payload.status = input.status;
      }
      if (input.hireDate !== undefined) {
        payload.hire_date = input.hireDate;
      }
      if (input.terminationDate !== undefined) {
        payload.termination_date = input.terminationDate;
      }

      const { data, error } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", id)
        .select(EMPLOYEE_SELECT)
        .single();

      if (error || !data) {
        return Result.err(mapDatabaseError(error, "Failed to update employee."));
      }

      return Result.ok(mapEmployeeRowToDomain(data));
    } catch (err) {
      return Result.err(mapDatabaseError(err, "Unexpected error updating employee."));
    }
  },

  /**
   * Deletes an employee record. Protected by database foreign-key constraints (RESTRICT)
   * if referenced by payroll records.
   */
  async deleteEmployee(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<Result<boolean>> {
    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);

      if (error) {
        return Result.err(
          mapDatabaseError(
            error,
            "Cannot delete employee because historical payroll records depend on this profile."
          )
        );
      }

      return Result.ok(true);
    } catch (err) {
      return Result.err(mapDatabaseError(err, "Unexpected error deleting employee."));
    }
  },

  /**
   * Loads current payroll defaults for an employee (if any).
   */
  async findPayrollDetailsByEmployeeId(
    supabase: SupabaseClient<Database>,
    employeeId: string
  ): Promise<EmployeePayrollDetails | null> {
    try {
      const { data, error } = await supabase
        .from("employee_payroll_details")
        .select(PAYROLL_DETAILS_SELECT)
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error || !data) return null;
      return mapEmployeePayrollDetailsRowToDomain(data);
    } catch {
      return null;
    }
  },

  /**
   * Loads employee master + current payroll defaults.
   */
  async findWithPayrollDetails(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<EmployeeWithPayrollDetails | null> {
    const employee = await EmployeeRepository.findById(supabase, id);
    if (!employee) return null;

    const payrollDetails = await EmployeeRepository.findPayrollDetailsByEmployeeId(
      supabase,
      id
    );

    return { ...employee, payrollDetails };
  },

  /**
   * Creates or updates current default compensation for an employee.
   * Touches only `employee_payroll_details` — never `payroll_items`.
   */
  async upsertPayrollDetails(
    supabase: SupabaseClient<Database>,
    employeeId: string,
    input: UpsertEmployeePayrollDetailsInput
  ): Promise<Result<EmployeePayrollDetails>> {
    try {
      const existing = await EmployeeRepository.findPayrollDetailsByEmployeeId(
        supabase,
        employeeId
      );

      if (existing) {
        const payload: PayrollDetailsUpdate = {
          basic_salary: input.basicSalary,
          allowances: input.allowances ?? 0,
          allowances_breakdown: (input.allowancesBreakdown ??
            {}) as Json,
          variable_pay_label: emptyToNull(input.variablePayLabel),
          variable_pay_amount: input.variablePayAmount ?? 0,
          notes: emptyToNull(input.notes),
          effective_from: input.effectiveFrom || null,
        };

        const { data, error } = await supabase
          .from("employee_payroll_details")
          .update(payload)
          .eq("employee_id", employeeId)
          .select(PAYROLL_DETAILS_SELECT)
          .single();

        if (error || !data) {
          return Result.err(
            mapDatabaseError(error, "Failed to update employee payroll details.")
          );
        }

        return Result.ok(mapEmployeePayrollDetailsRowToDomain(data));
      }

      const insertPayload: PayrollDetailsInsert = {
        employee_id: employeeId,
        basic_salary: input.basicSalary,
        allowances: input.allowances ?? 0,
        allowances_breakdown: (input.allowancesBreakdown ?? {}) as Json,
        variable_pay_label: emptyToNull(input.variablePayLabel),
        variable_pay_amount: input.variablePayAmount ?? 0,
        notes: emptyToNull(input.notes),
        effective_from: input.effectiveFrom || null,
      };

      const { data, error } = await supabase
        .from("employee_payroll_details")
        .insert(insertPayload)
        .select(PAYROLL_DETAILS_SELECT)
        .single();

      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to create employee payroll details.")
        );
      }

      return Result.ok(mapEmployeePayrollDetailsRowToDomain(data));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error saving employee payroll details.")
      );
    }
  },
};
