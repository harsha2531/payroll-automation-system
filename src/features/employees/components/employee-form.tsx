"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EmployeeWithPayrollDetails, EmployeeStatus } from "@/types/payroll";
import {
  createEmployeeAction,
  updateEmployeeAction,
} from "@/features/employees/actions";
import {
  validateCreateEmployeeInput,
  validateUpdateEmployeeInput,
} from "@/features/employees/validation";

const STATUS_OPTIONS: EmployeeStatus[] = [
  "active",
  "inactive",
  "terminated",
  "on_leave",
];

export interface EmployeeFormProps {
  mode: "create" | "edit";
  employee?: EmployeeWithPayrollDetails;
}

interface FormState {
  employeeNumber: string;
  fullName: string;
  email: string;
  designation: string;
  department: string;
  phone: string;
  epfNumber: string;
  status: EmployeeStatus;
  hireDate: string;
  terminationDate: string;
  basicSalary: string;
  allowances: string;
  variablePayLabel: string;
  variablePayAmount: string;
  payrollNotes: string;
  effectiveFrom: string;
}

function toFormState(employee?: EmployeeWithPayrollDetails): FormState {
  return {
    employeeNumber: employee?.employeeNumber ?? "",
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    designation: employee?.designation ?? "",
    department: employee?.department ?? "",
    phone: employee?.phone ?? "",
    epfNumber: employee?.epfNumber ?? "",
    status: employee?.status ?? "active",
    hireDate: employee?.hireDate ?? "",
    terminationDate: employee?.terminationDate ?? "",
    basicSalary:
      employee?.payrollDetails?.basicSalary !== undefined
        ? String(employee.payrollDetails.basicSalary)
        : "0",
    allowances:
      employee?.payrollDetails?.allowances !== undefined
        ? String(employee.payrollDetails.allowances)
        : "0",
    variablePayLabel: employee?.payrollDetails?.variablePayLabel ?? "",
    variablePayAmount:
      employee?.payrollDetails?.variablePayAmount !== undefined
        ? String(employee.payrollDetails.variablePayAmount)
        : "0",
    payrollNotes: employee?.payrollDetails?.notes ?? "",
    effectiveFrom: employee?.payrollDetails?.effectiveFrom ?? "",
  };
}

function toPayload(state: FormState) {
  return {
    employeeNumber: state.employeeNumber,
    fullName: state.fullName,
    email: state.email,
    designation: state.designation || null,
    department: state.department || null,
    phone: state.phone || null,
    epfNumber: state.epfNumber || null,
    status: state.status,
    hireDate: state.hireDate || null,
    terminationDate: state.terminationDate || null,
    basicSalary: state.basicSalary === "" ? 0 : Number(state.basicSalary),
    allowances: state.allowances === "" ? 0 : Number(state.allowances),
    variablePayLabel: state.variablePayLabel || null,
    variablePayAmount:
      state.variablePayAmount === "" ? 0 : Number(state.variablePayAmount),
    payrollNotes: state.payrollNotes || null,
    effectiveFrom: state.effectiveFrom || null,
  };
}

export function EmployeeForm({ mode, employee }: EmployeeFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toFormState(employee));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = toPayload(state);
    const clientValidation =
      mode === "create"
        ? validateCreateEmployeeInput(payload)
        : validateUpdateEmployeeInput(payload);

    if (!clientValidation.success) {
      setFieldErrors(clientValidation.errors ?? {});
      setError("Please correct the highlighted errors.");
      return;
    }

    startTransition(async () => {
      try {
        const result =
          mode === "create"
            ? await createEmployeeAction(payload)
            : await updateEmployeeAction(employee!.id, payload);

        if (!result.success) {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setError(result.error ?? "Failed to save employee.");
          return;
        }

        setSuccess(
          mode === "create"
            ? "Employee created successfully."
            : "Employee updated successfully."
        );

        if (mode === "create" && result.data) {
          router.push(`/employees/${result.data.id}?created=1`);
          router.refresh();
          return;
        }

        router.push(`/employees/${employee!.id}?updated=1`);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
          <CardDescription>
            Persistent identity and contact information for this employee.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="employeeNumber"
            label="Employee number"
            required
            disabled={isPending}
            value={state.employeeNumber}
            error={fieldErrors.employeeNumber}
            onChange={(v) => updateField("employeeNumber", v)}
          />
          <Field
            id="epfNumber"
            label="EPF number"
            disabled={isPending}
            value={state.epfNumber}
            error={fieldErrors.epfNumber}
            onChange={(v) => updateField("epfNumber", v)}
            placeholder="Optional"
          />
          <Field
            id="fullName"
            label="Full name"
            required
            disabled={isPending}
            value={state.fullName}
            error={fieldErrors.fullName}
            onChange={(v) => updateField("fullName", v)}
            className="sm:col-span-2"
          />
          <Field
            id="email"
            label="Email"
            type="email"
            required
            disabled={isPending}
            value={state.email}
            error={fieldErrors.email}
            onChange={(v) => updateField("email", v)}
          />
          <Field
            id="phone"
            label="Phone"
            disabled={isPending}
            value={state.phone}
            error={fieldErrors.phone}
            onChange={(v) => updateField("phone", v)}
          />
          <Field
            id="designation"
            label="Designation"
            disabled={isPending}
            value={state.designation}
            error={fieldErrors.designation}
            onChange={(v) => updateField("designation", v)}
          />
          <Field
            id="department"
            label="Department"
            disabled={isPending}
            value={state.department}
            error={fieldErrors.department}
            onChange={(v) => updateField("department", v)}
          />
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              disabled={isPending}
              value={state.status}
              onChange={(e) =>
                updateField("status", e.target.value as EmployeeStatus)
              }
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                fieldErrors.status && "border-destructive"
              )}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace("_", " ")}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p className="text-xs text-destructive">{fieldErrors.status}</p>
            )}
          </div>
          <Field
            id="hireDate"
            label="Hire date"
            type="date"
            disabled={isPending}
            value={state.hireDate}
            error={fieldErrors.hireDate}
            onChange={(v) => updateField("hireDate", v)}
          />
          <Field
            id="terminationDate"
            label="Termination date"
            type="date"
            disabled={isPending}
            value={state.terminationDate}
            error={fieldErrors.terminationDate}
            onChange={(v) => updateField("terminationDate", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current payroll details</CardTitle>
          <CardDescription>
            Default salary and allowances. Changing these values does not alter
            previously saved monthly payroll records.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="basicSalary"
            label="Basic salary"
            type="number"
            step="0.01"
            min="0"
            disabled={isPending}
            value={state.basicSalary}
            error={fieldErrors.basicSalary}
            onChange={(v) => updateField("basicSalary", v)}
          />
          <Field
            id="allowances"
            label="Allowances"
            type="number"
            step="0.01"
            min="0"
            disabled={isPending}
            value={state.allowances}
            error={fieldErrors.allowances}
            onChange={(v) => updateField("allowances", v)}
          />
          <Field
            id="variablePayLabel"
            label="Variable pay label"
            disabled={isPending}
            value={state.variablePayLabel}
            error={fieldErrors.variablePayLabel}
            onChange={(v) => updateField("variablePayLabel", v)}
            placeholder="e.g. Overtime"
          />
          <Field
            id="variablePayAmount"
            label="Variable pay amount"
            type="number"
            step="0.01"
            min="0"
            disabled={isPending}
            value={state.variablePayAmount}
            error={fieldErrors.variablePayAmount}
            onChange={(v) => updateField("variablePayAmount", v)}
          />
          <Field
            id="effectiveFrom"
            label="Effective from"
            type="date"
            disabled={isPending}
            value={state.effectiveFrom}
            error={fieldErrors.effectiveFrom}
            onChange={(v) => updateField("effectiveFrom", v)}
          />
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="payrollNotes">Payroll notes</Label>
            <textarea
              id="payrollNotes"
              disabled={isPending}
              value={state.payrollNotes}
              onChange={(e) => updateField("payrollNotes", e.target.value)}
              rows={3}
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                fieldErrors.payrollNotes && "border-destructive"
              )}
            />
            {fieldErrors.payrollNotes && (
              <p className="text-xs text-destructive">{fieldErrors.payrollNotes}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Add employee"
          ) : (
            "Save changes"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  disabled,
  type = "text",
  placeholder,
  step,
  min,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type={type}
        step={step}
        min={min}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
