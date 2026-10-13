import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Employee, EmployeeStatus } from "@/types/payroll";
import { Result, type PaginationParams, type PaginatedResult } from "@/types/common";
import { mapDatabaseError } from "./errors";

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

export function mapEmployeeRowToDomain(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    email: row.email,
    designation: row.designation,
    department: row.department,
    phone: row.phone,
    status: row.status,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListEmployeesFilters extends PaginationParams {
  status?: EmployeeStatus;
  search?: string;
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
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at"
        )
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
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at"
        )
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
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at"
        )
        .eq("email", email.trim().toLowerCase())
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
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at",
          { count: "exact" }
        );

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      if (filters.search) {
        const term = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${term}%,employee_number.ilike.%${term}%,email.ilike.%${term}%`
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
    input: {
      employeeNumber: string;
      fullName: string;
      email: string;
      designation?: string | null;
      department?: string | null;
      phone?: string | null;
      status?: EmployeeStatus;
      hireDate?: string | null;
      terminationDate?: string | null;
    }
  ): Promise<Result<Employee>> {
    try {
      const payload: EmployeeInsert = {
        employee_number: input.employeeNumber.trim(),
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        designation: input.designation?.trim() || null,
        department: input.department?.trim() || null,
        phone: input.phone?.trim() || null,
        status: input.status || "active",
        hire_date: input.hireDate || null,
        termination_date: input.terminationDate || null,
      };

      const { data, error } = await supabase
        .from("employees")
        .insert(payload)
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at"
        )
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
   * Updates an existing employee record.
   */
  async updateEmployee(
    supabase: SupabaseClient<Database>,
    id: string,
    input: Partial<{
      employeeNumber: string;
      fullName: string;
      email: string;
      designation: string | null;
      department: string | null;
      phone: string | null;
      status: EmployeeStatus;
      hireDate: string | null;
      terminationDate: string | null;
    }>
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
        payload.designation = input.designation ? input.designation.trim() : null;
      }
      if (input.department !== undefined) {
        payload.department = input.department ? input.department.trim() : null;
      }
      if (input.phone !== undefined) {
        payload.phone = input.phone ? input.phone.trim() : null;
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
        .select(
          "id, employee_number, full_name, email, designation, department, phone, status, hire_date, termination_date, created_at, updated_at"
        )
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
};
