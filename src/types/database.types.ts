/**
 * Supabase Database TypeScript Definitions
 * Auto-generated / aligned with PostgreSQL schema migrations:
 * - 20261013000000_create_profiles_table.sql
 * - 20261013010000_create_payroll_schema.sql
 *
 * Regeneration Command:
 *   npx supabase gen types typescript --local > src/types/database.types.ts
 * Or via remote project:
 *   npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "admin" | "employee";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "admin" | "employee";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: "admin" | "employee";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      employees: {
        Row: {
          id: string;
          employee_number: string;
          full_name: string;
          email: string;
          designation: string | null;
          department: string | null;
          phone: string | null;
          status: "active" | "inactive" | "terminated" | "on_leave";
          hire_date: string | null;
          termination_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_number: string;
          full_name: string;
          email: string;
          designation?: string | null;
          department?: string | null;
          phone?: string | null;
          status?: "active" | "inactive" | "terminated" | "on_leave";
          hire_date?: string | null;
          termination_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_number?: string;
          full_name?: string;
          email?: string;
          designation?: string | null;
          department?: string | null;
          phone?: string | null;
          status?: "active" | "inactive" | "terminated" | "on_leave";
          hire_date?: string | null;
          termination_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      payroll_runs: {
        Row: {
          id: string;
          year: number;
          month: number;
          sequence_number: number;
          run_type: "regular" | "supplementary" | "correction" | "bonus";
          status:
            | "draft"
            | "processing"
            | "calculated"
            | "approved"
            | "completed"
            | "failed"
            | "cancelled";
          created_by: string | null;
          approved_by: string | null;
          source_filename: string | null;
          import_metadata: Json;
          total_employees: number;
          total_gross_pay: number;
          total_deductions: number;
          total_net_pay: number;
          notes: string | null;
          error_message: string | null;
          approved_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          month: number;
          sequence_number?: number;
          run_type?: "regular" | "supplementary" | "correction" | "bonus";
          status?:
            | "draft"
            | "processing"
            | "calculated"
            | "approved"
            | "completed"
            | "failed"
            | "cancelled";
          created_by?: string | null;
          approved_by?: string | null;
          source_filename?: string | null;
          import_metadata?: Json;
          total_employees?: number;
          total_gross_pay?: number;
          total_deductions?: number;
          total_net_pay?: number;
          notes?: string | null;
          error_message?: string | null;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          month?: number;
          sequence_number?: number;
          run_type?: "regular" | "supplementary" | "correction" | "bonus";
          status?:
            | "draft"
            | "processing"
            | "calculated"
            | "approved"
            | "completed"
            | "failed"
            | "cancelled";
          created_by?: string | null;
          approved_by?: string | null;
          source_filename?: string | null;
          import_metadata?: Json;
          total_employees?: number;
          total_gross_pay?: number;
          total_deductions?: number;
          total_net_pay?: number;
          notes?: string | null;
          error_message?: string | null;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      payroll_items: {
        Row: {
          id: string;
          payroll_run_id: string;
          employee_id: string;
          employee_number_snapshot: string;
          employee_name_snapshot: string;
          employee_email_snapshot: string;
          designation_snapshot: string | null;
          department_snapshot: string | null;
          basic_salary: number;
          variable_pay_label: string | null;
          variable_pay_amount: number;
          allowances: number;
          gross_pay: number;
          total_deductions: number;
          employer_contributions: number;
          net_pay: number;
          earnings_breakdown: Json;
          deductions_breakdown: Json;
          calculation_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payroll_run_id: string;
          employee_id: string;
          employee_number_snapshot: string;
          employee_name_snapshot: string;
          employee_email_snapshot: string;
          designation_snapshot?: string | null;
          department_snapshot?: string | null;
          basic_salary?: number;
          variable_pay_label?: string | null;
          variable_pay_amount?: number;
          allowances?: number;
          gross_pay?: number;
          total_deductions?: number;
          employer_contributions?: number;
          net_pay: number;
          earnings_breakdown?: Json;
          deductions_breakdown?: Json;
          calculation_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payroll_run_id?: string;
          employee_id?: string;
          employee_number_snapshot?: string;
          employee_name_snapshot?: string;
          employee_email_snapshot?: string;
          designation_snapshot?: string | null;
          department_snapshot?: string | null;
          basic_salary?: number;
          variable_pay_label?: string | null;
          variable_pay_amount?: number;
          allowances?: number;
          gross_pay?: number;
          total_deductions?: number;
          employer_contributions?: number;
          net_pay?: number;
          earnings_breakdown?: Json;
          deductions_breakdown?: Json;
          calculation_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey";
            columns: ["payroll_run_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_items_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };

      payslip_documents: {
        Row: {
          id: string;
          payroll_item_id: string;
          payroll_run_id: string;
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          file_size_bytes: number | null;
          file_hash: string | null;
          mime_type: string;
          status: "pending" | "generated" | "failed";
          error_message: string | null;
          generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payroll_item_id: string;
          payroll_run_id: string;
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          file_size_bytes?: number | null;
          file_hash?: string | null;
          mime_type?: string;
          status?: "pending" | "generated" | "failed";
          error_message?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payroll_item_id?: string;
          payroll_run_id?: string;
          storage_bucket?: string;
          storage_path?: string;
          file_name?: string;
          file_size_bytes?: number | null;
          file_hash?: string | null;
          mime_type?: string;
          status?: "pending" | "generated" | "failed";
          error_message?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payslip_documents_payroll_item_id_fkey";
            columns: ["payroll_item_id"];
            isOneToOne: true;
            referencedRelation: "payroll_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payslip_documents_payroll_run_id_fkey";
            columns: ["payroll_run_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id"];
          }
        ];
      };

      email_deliveries: {
        Row: {
          id: string;
          payroll_item_id: string;
          payslip_document_id: string | null;
          recipient_email: string;
          recipient_name: string | null;
          delivery_status:
            | "pending"
            | "queued"
            | "sending"
            | "sent"
            | "delivered"
            | "failed"
            | "bounced";
          provider: string;
          provider_message_id: string | null;
          attempt_count: number;
          max_attempts: number;
          error_message: string | null;
          error_details: Json;
          idempotency_key: string;
          sent_at: string | null;
          last_attempt_at: string | null;
          next_retry_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payroll_item_id: string;
          payslip_document_id?: string | null;
          recipient_email: string;
          recipient_name?: string | null;
          delivery_status?:
            | "pending"
            | "queued"
            | "sending"
            | "sent"
            | "delivered"
            | "failed"
            | "bounced";
          provider?: string;
          provider_message_id?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          error_message?: string | null;
          error_details?: Json;
          idempotency_key: string;
          sent_at?: string | null;
          last_attempt_at?: string | null;
          next_retry_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payroll_item_id?: string;
          payslip_document_id?: string | null;
          recipient_email?: string;
          recipient_name?: string | null;
          delivery_status?:
            | "pending"
            | "queued"
            | "sending"
            | "sent"
            | "delivered"
            | "failed"
            | "bounced";
          provider?: string;
          provider_message_id?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          error_message?: string | null;
          error_details?: Json;
          idempotency_key?: string;
          sent_at?: string | null;
          last_attempt_at?: string | null;
          next_retry_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_deliveries_payroll_item_id_fkey";
            columns: ["payroll_item_id"];
            isOneToOne: false;
            referencedRelation: "payroll_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_deliveries_payslip_document_id_fkey";
            columns: ["payslip_document_id"];
            isOneToOne: false;
            referencedRelation: "payslip_documents";
            referencedColumns: ["id"];
          }
        ];
      };

      processing_jobs: {
        Row: {
          id: string;
          job_type:
            | "payroll_import"
            | "payroll_calculation"
            | "payslip_pdf_generation"
            | "email_dispatch"
            | "bulk_email_dispatch";
          status:
            | "queued"
            | "claimed"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled";
          payload: Json;
          result: Json;
          error_message: string | null;
          error_details: Json;
          attempts: number;
          max_attempts: number;
          available_at: string;
          claimed_at: string | null;
          claimed_by: string | null;
          locked_until: string | null;
          idempotency_key: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_type:
            | "payroll_import"
            | "payroll_calculation"
            | "payslip_pdf_generation"
            | "email_dispatch"
            | "bulk_email_dispatch";
          status?:
            | "queued"
            | "claimed"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled";
          payload?: Json;
          result?: Json;
          error_message?: string | null;
          error_details?: Json;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          locked_until?: string | null;
          idempotency_key?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_type?:
            | "payroll_import"
            | "payroll_calculation"
            | "payslip_pdf_generation"
            | "email_dispatch"
            | "bulk_email_dispatch";
          status?:
            | "queued"
            | "claimed"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled";
          payload?: Json;
          result?: Json;
          error_message?: string | null;
          error_details?: Json;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          locked_until?: string | null;
          idempotency_key?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
