import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  PayrollRun,
  PayrollRunStatus,
  PayrollRunType,
  PayrollItem,
  PayslipDocument,
  PayslipDocumentStatus,
  EmailDelivery,
  EmailDeliveryStatus,
  ProcessingJob,
  ProcessingJobType,
  ProcessingJobStatus,
} from "@/types/payroll";
import { Result, type PaginationParams, type PaginatedResult } from "@/types/common";
import { mapDatabaseError } from "./errors";

// -----------------------------------------------------------------------------
// Row mappers – convert raw DB rows to domain models
// -----------------------------------------------------------------------------

type PayrollRunRow = Database["public"]["Tables"]["payroll_runs"]["Row"];
type PayrollRunInsert = Database["public"]["Tables"]["payroll_runs"]["Insert"];
type PayrollRunUpdate = Database["public"]["Tables"]["payroll_runs"]["Update"];

function mapPayrollRun(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    sequenceNumber: row.sequence_number,
    runType: row.run_type as PayrollRunType,
    status: row.status as PayrollRunStatus,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    sourceFilename: row.source_filename,
    importMetadata: row.import_metadata,
    totalEmployees: row.total_employees,
    totalGrossPay: row.total_gross_pay,
    totalDeductions: row.total_deductions,
    totalNetPay: row.total_net_pay,
    notes: row.notes,
    errorMessage: row.error_message,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PayrollItemRow = Database["public"]["Tables"]["payroll_items"]["Row"];
type PayrollItemInsert = Database["public"]["Tables"]["payroll_items"]["Insert"];
type PayrollItemUpdate = Database["public"]["Tables"]["payroll_items"]["Update"];

function mapPayrollItem(row: PayrollItemRow): PayrollItem {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    employeeNumberSnapshot: row.employee_number_snapshot,
    employeeNameSnapshot: row.employee_name_snapshot,
    employeeEmailSnapshot: row.employee_email_snapshot,
    designationSnapshot: row.designation_snapshot,
    departmentSnapshot: row.department_snapshot,
    basicSalary: row.basic_salary,
    variablePayLabel: row.variable_pay_label,
    variablePayAmount: row.variable_pay_amount,
    allowances: row.allowances,
    grossPay: row.gross_pay,
    totalDeductions: row.total_deductions,
    employerContributions: row.employer_contributions,
    netPay: row.net_pay,
    earningsBreakdown: row.earnings_breakdown,
    deductionsBreakdown: row.deductions_breakdown,
    calculationMetadata: row.calculation_metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PayslipDocumentRow = Database["public"]["Tables"]["payslip_documents"]["Row"];
type PayslipDocumentInsert = Database["public"]["Tables"]["payslip_documents"]["Insert"];
type PayslipDocumentUpdate = Database["public"]["Tables"]["payslip_documents"]["Update"];

function mapPayslipDocument(row: PayslipDocumentRow): PayslipDocument {
  return {
    id: row.id,
    payrollItemId: row.payroll_item_id,
    payrollRunId: row.payroll_run_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    fileHash: row.file_hash,
    mimeType: row.mime_type,
    status: row.status as PayslipDocumentStatus,
    errorMessage: row.error_message,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type EmailDeliveryRow = Database["public"]["Tables"]["email_deliveries"]["Row"];
type EmailDeliveryInsert = Database["public"]["Tables"]["email_deliveries"]["Insert"];
type EmailDeliveryUpdate = Database["public"]["Tables"]["email_deliveries"]["Update"];

function mapEmailDelivery(row: EmailDeliveryRow): EmailDelivery {
  return {
    id: row.id,
    payrollItemId: row.payroll_item_id,
    payslipDocumentId: row.payslip_document_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    deliveryStatus: row.delivery_status as EmailDeliveryStatus,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    errorDetails: row.error_details,
    idempotencyKey: row.idempotency_key,
    sentAt: row.sent_at,
    lastAttemptAt: row.last_attempt_at,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ProcessingJobRow = Database["public"]["Tables"]["processing_jobs"]["Row"];
type ProcessingJobInsert = Database["public"]["Tables"]["processing_jobs"]["Insert"];
type ProcessingJobUpdate = Database["public"]["Tables"]["processing_jobs"]["Update"];

function mapProcessingJob(row: ProcessingJobRow): ProcessingJob {
  return {
    id: row.id,
    jobType: row.job_type as ProcessingJobType,
    status: row.status as ProcessingJobStatus,
    payload: row.payload,
    result: row.result,
    errorMessage: row.error_message,
    errorDetails: row.error_details,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    claimedAt: row.claimed_at,
    claimedBy: row.claimed_by,
    lockedUntil: row.locked_until,
    idempotencyKey: row.idempotency_key,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -----------------------------------------------------------------------------
// PayrollRun Repository
// -----------------------------------------------------------------------------
export const PayrollRunRepository = {
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<PayrollRun | null> {
    try {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapPayrollRun(data as PayrollRunRow);
    } catch {
      return null;
    }
  },

  async listRuns(
    supabase: SupabaseClient<Database>,
    filters: PaginationParams & {
      year?: number;
      month?: number;
      status?: PayrollRunStatus;
    }
  ): Promise<Result<PaginatedResult<PayrollRun>>> {
    try {
      const page = Math.max(1, filters.page || 1);
      const pageSize = Math.max(1, Math.min(100, filters.pageSize || 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("payroll_runs")
        .select("*", { count: "exact" });

      if (filters.year !== undefined) query = query.eq("year", filters.year);
      if (filters.month !== undefined) query = query.eq("month", filters.month);
      if (filters.status) query = query.eq("status", filters.status);

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return Result.err(
          mapDatabaseError(error, "Failed to retrieve payroll runs.")
        );
      }

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      return Result.ok({
        items: (data || []).map(mapPayrollRun),
        total,
        page,
        pageSize,
        totalPages,
      });
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error retrieving payroll runs.")
      );
    }
  },

  async createRun(
    supabase: SupabaseClient<Database>,
    input: PayrollRunInsert
  ): Promise<Result<PayrollRun>> {
    try {
      const { data, error } = await supabase
        .from("payroll_runs")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to create payroll run.")
        );
      }
      return Result.ok(mapPayrollRun(data as PayrollRunRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error creating payroll run.")
      );
    }
  },

  async updateRunStatus(
    supabase: SupabaseClient<Database>,
    id: string,
    status: PayrollRunStatus,
    updates: Partial<PayrollRunUpdate>
  ): Promise<Result<PayrollRun>> {
    try {
      const payload: PayrollRunUpdate = { status, ...updates } as PayrollRunUpdate;
      const { data, error } = await supabase
        .from("payroll_runs")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to update payroll run.")
        );
      }
      return Result.ok(mapPayrollRun(data as PayrollRunRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error updating payroll run.")
      );
    }
  },
};

// -----------------------------------------------------------------------------
// PayrollItem Repository
// -----------------------------------------------------------------------------
export const PayrollItemRepository = {
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<PayrollItem | null> {
    try {
      const { data, error } = await supabase
        .from("payroll_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapPayrollItem(data as PayrollItemRow);
    } catch {
      return null;
    }
  },

  async listByRun(
    supabase: SupabaseClient<Database>,
    payrollRunId: string,
    pagination: PaginationParams
  ): Promise<Result<PaginatedResult<PayrollItem>>> {
    try {
      const page = Math.max(1, pagination.page || 1);
      const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("payroll_items")
        .select("*", { count: "exact" })
        .eq("payroll_run_id", payrollRunId)
        .order("employee_number_snapshot", { ascending: true })
        .range(from, to);

      if (error) {
        return Result.err(
          mapDatabaseError(error, "Failed to list payroll items.")
        );
      }

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      return Result.ok({
        items: (data || []).map(mapPayrollItem),
        total,
        page,
        pageSize,
        totalPages,
      });
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error listing payroll items.")
      );
    }
  },

  async createItem(
    supabase: SupabaseClient<Database>,
    input: PayrollItemInsert
  ): Promise<Result<PayrollItem>> {
    try {
      const { data, error } = await supabase
        .from("payroll_items")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to create payroll item.")
        );
      }
      return Result.ok(mapPayrollItem(data as PayrollItemRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error creating payroll item.")
      );
    }
  },

  async updateItem(
    supabase: SupabaseClient<Database>,
    id: string,
    input: Partial<PayrollItemUpdate>
  ): Promise<Result<PayrollItem>> {
    try {
      const { data, error } = await supabase
        .from("payroll_items")
        .update(input)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to update payroll item.")
        );
      }
      return Result.ok(mapPayrollItem(data as PayrollItemRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error updating payroll item.")
      );
    }
  },
};

// -----------------------------------------------------------------------------
// PayslipDocument Repository
// -----------------------------------------------------------------------------
export const PayslipDocumentRepository = {
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<PayslipDocument | null> {
    try {
      const { data, error } = await supabase
        .from("payslip_documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapPayslipDocument(data as PayslipDocumentRow);
    } catch {
      return null;
    }
  },

  async createDocument(
    supabase: SupabaseClient<Database>,
    input: PayslipDocumentInsert
  ): Promise<Result<PayslipDocument>> {
    try {
      const { data, error } = await supabase
        .from("payslip_documents")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to create payslip document.")
        );
      }
      return Result.ok(mapPayslipDocument(data as PayslipDocumentRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error creating payslip document.")
      );
    }
  },

  async updateStatus(
    supabase: SupabaseClient<Database>,
    id: string,
    status: PayslipDocumentStatus,
    updates: Partial<PayslipDocumentUpdate>
  ): Promise<Result<PayslipDocument>> {
    try {
      const payload: PayslipDocumentUpdate = {
        status,
        ...updates,
      } as PayslipDocumentUpdate;
      const { data, error } = await supabase
        .from("payslip_documents")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to update payslip document.")
        );
      }
      return Result.ok(mapPayslipDocument(data as PayslipDocumentRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error updating payslip document.")
      );
    }
  },
};

// -----------------------------------------------------------------------------
// EmailDelivery Repository
// -----------------------------------------------------------------------------
export const EmailDeliveryRepository = {
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<EmailDelivery | null> {
    try {
      const { data, error } = await supabase
        .from("email_deliveries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapEmailDelivery(data as EmailDeliveryRow);
    } catch {
      return null;
    }
  },

  async createDelivery(
    supabase: SupabaseClient<Database>,
    input: EmailDeliveryInsert
  ): Promise<Result<EmailDelivery>> {
    try {
      const { data, error } = await supabase
        .from("email_deliveries")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to create email delivery.")
        );
      }
      return Result.ok(mapEmailDelivery(data as EmailDeliveryRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error creating email delivery.")
      );
    }
  },

  async updateStatus(
    supabase: SupabaseClient<Database>,
    id: string,
    status: EmailDeliveryStatus,
    updates: Partial<EmailDeliveryUpdate>
  ): Promise<Result<EmailDelivery>> {
    try {
      const payload: EmailDeliveryUpdate = {
        delivery_status: status,
        ...updates,
      } as EmailDeliveryUpdate;
      const { data, error } = await supabase
        .from("email_deliveries")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to update email delivery.")
        );
      }
      return Result.ok(mapEmailDelivery(data as EmailDeliveryRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error updating email delivery.")
      );
    }
  },
};

// -----------------------------------------------------------------------------
// ProcessingJob Repository
// -----------------------------------------------------------------------------
export const ProcessingJobRepository = {
  async findById(
    supabase: SupabaseClient<Database>,
    id: string
  ): Promise<ProcessingJob | null> {
    try {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return mapProcessingJob(data as ProcessingJobRow);
    } catch {
      return null;
    }
  },

  async enqueue(
    supabase: SupabaseClient<Database>,
    input: ProcessingJobInsert
  ): Promise<Result<ProcessingJob>> {
    try {
      const { data, error } = await supabase
        .from("processing_jobs")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to enqueue processing job.")
        );
      }
      return Result.ok(mapProcessingJob(data as ProcessingJobRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error enqueueing processing job.")
      );
    }
  },

  async updateJob(
    supabase: SupabaseClient<Database>,
    id: string,
    updates: Partial<ProcessingJobUpdate>
  ): Promise<Result<ProcessingJob>> {
    try {
      const { data, error } = await supabase
        .from("processing_jobs")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return Result.err(
          mapDatabaseError(error, "Failed to update processing job.")
        );
      }
      return Result.ok(mapProcessingJob(data as ProcessingJobRow));
    } catch (err) {
      return Result.err(
        mapDatabaseError(err, "Unexpected error updating processing job.")
      );
    }
  },
};

// End of repository implementations
