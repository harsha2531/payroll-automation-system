"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  confirmPayrollImportAction,
  previewPayrollImportAction,
} from "@/features/payroll/import-actions";
import type {
  ImportPreview,
  ImportPreviewRow,
  ImportRowCorrection,
  ImportSummary,
} from "@/features/payroll/import-types";
import { formatCurrency } from "@/lib/format";

type Stage = "upload" | "preview" | "summary";

function dispositionLabel(row: ImportPreviewRow): string {
  switch (row.disposition) {
    case "import_new_employee":
      return "New employee + payroll";
    case "import_existing_employee":
      return "Import payroll";
    case "fill_missing_employee_fields":
      return "Fill missing details + payroll";
    case "skip_duplicate_period":
      return "Skip duplicate period";
    case "reject":
      return "Rejected";
  }
}

function dispositionVariant(
  disposition: ImportPreviewRow["disposition"]
): "default" | "secondary" | "outline" | "destructive" {
  if (disposition === "reject") return "destructive";
  if (disposition === "skip_duplicate_period") return "secondary";
  if (disposition === "fill_missing_employee_fields") return "outline";
  return "default";
}

export function ExcelImportWizard() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const importableCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.included &&
          r.disposition !== "reject" &&
          r.disposition !== "skip_duplicate_period"
      ).length,
    [rows]
  );

  const blockingWorkbook = Boolean(
    preview?.mixedPeriods || preview?.workbookErrors.length
  );

  const updateRow = (rowId: string, patch: Partial<ImportPreviewRow>) => {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  };

  const buildCorrections = (): ImportRowCorrection[] =>
    rows.map((row) => ({
      rowId: row.rowId,
      sourceSheetName: row.sourceSheetName,
      originalEmployeeName: row.originalEmployeeName,
      employeeName: row.employeeName,
      email: row.email,
      epfNumber: row.epfNumber,
      designation: row.designation,
      included: row.included,
      applyEmployeeUpdates: row.applyEmployeeUpdates,
    }));

  const handlePreview = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose an .xlsx workbook to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      setProgress("Uploading and parsing workbook…");
      const result = await previewPayrollImportAction(formData);
      setProgress(null);
      if (!result.success || !result.data) {
        setError(result.error ?? "Unable to preview this workbook.");
        return;
      }
      setPreview(result.data);
      setRows(result.data.rows);
      setStage("preview");
    });
  };

  const handleConfirm = () => {
    setError(null);
    if (!file || !preview) return;
    if (blockingWorkbook) {
      setError(preview.workbookErrors[0] ?? "This workbook cannot be imported.");
      return;
    }
    if (importableCount === 0) {
      setError("There are no importable rows. Correct errors or cancel.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("corrections", JSON.stringify(buildCorrections()));

    startTransition(async () => {
      setProgress("Saving employee records and monthly payroll snapshots…");
      const result = await confirmPayrollImportAction(formData);
      setProgress(null);
      if (!result.success || !result.data) {
        setError(result.error ?? "Import failed.");
        return;
      }
      setSummary(result.data);
      setStage("summary");
    });
  };

  const reset = () => {
    setStage("upload");
    setFile(null);
    setError(null);
    setPreview(null);
    setRows([]);
    setSummary(null);
    setProgress(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {progress && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      )}

      {stage === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload payroll workbook
            </CardTitle>
            <CardDescription>
              .xlsx files only, up to 10 MB. The file is parsed on the server and
              is not stored after import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePreview} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="payroll-file">Excel file</Label>
                <Input
                  id="payroll-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={isPending}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={isPending || !file}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Preview import
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {stage === "preview" && preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Import preview</CardTitle>
              <CardDescription>
                {preview.sourceFilename}
                {preview.periodLabel ? ` · ${preview.periodLabel}` : ""}
                {preview.year && preview.month
                  ? ` (${preview.year}-${String(preview.month).padStart(2, "0")})`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Importable {preview.counts.importable} · Will update{" "}
                {preview.counts.willUpdate} · Skipped {preview.counts.skipped} ·
                Rejected {preview.counts.rejected}
              </p>
              {preview.workbookErrors.map((msg) => (
                <p key={msg} className="text-destructive">
                  {msg}
                </p>
              ))}
              <p className="text-muted-foreground">
                Salary amounts are taken from the workbook and are not
                recalculated. Existing employee details and previous monthly
                snapshots are not overwritten unless you explicitly allow filling
                missing fields.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {rows.map((row) => (
              <Card key={row.rowId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {row.employeeName || row.sourceSheetName || "Unnamed sheet"}
                      </CardTitle>
                      <CardDescription>
                        Sheet: {row.sourceSheetName || "—"} · Match:{" "}
                        {row.identityMatch}
                      </CardDescription>
                    </div>
                    <Badge variant={dispositionVariant(row.disposition)}>
                      {dispositionLabel(row)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Name"
                      value={row.employeeName}
                      disabled={isPending}
                      onChange={(v) => updateRow(row.rowId, { employeeName: v })}
                    />
                    <Field
                      label="EPF number"
                      value={row.epfNumber}
                      disabled={isPending}
                      onChange={(v) => updateRow(row.rowId, { epfNumber: v })}
                    />
                    <Field
                      label="Email"
                      value={row.email}
                      disabled={isPending}
                      onChange={(v) => updateRow(row.rowId, { email: v })}
                    />
                    <Field
                      label="Designation"
                      value={row.designation}
                      disabled={isPending}
                      onChange={(v) => updateRow(row.rowId, { designation: v })}
                    />
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <Amount label="Gross" value={row.amounts.grossPay} />
                    <Amount label="Deductions" value={row.amounts.totalDeductions} />
                    <Amount label="Net" value={row.amounts.netPay} />
                    <Amount
                      label="Employer"
                      value={row.amounts.employerContributions}
                    />
                    <Amount label="Basic" value={row.amounts.basicSalary} />
                  </dl>

                  {row.issues.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {row.issues.map((issue, idx) => (
                        <li
                          key={`${issue.field}-${idx}`}
                          className={
                            issue.severity === "error"
                              ? "text-destructive"
                              : "text-amber-700 dark:text-amber-400"
                          }
                        >
                          {issue.severity === "error" ? "Error" : "Warning"}:{" "}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {row.warnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-xs text-amber-700 dark:text-amber-400"
                    >
                      {warning}
                    </p>
                  ))}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        disabled={isPending || row.disposition === "reject"}
                        onChange={(e) =>
                          updateRow(row.rowId, { included: e.target.checked })
                        }
                      />
                      Include in import
                    </label>
                    {row.existingEmployee && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.applyEmployeeUpdates}
                          disabled={isPending}
                          onChange={(e) =>
                            updateRow(row.rowId, {
                              applyEmployeeUpdates: e.target.checked,
                            })
                          }
                        />
                        Update existing employee details
                      </label>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || blockingWorkbook || importableCount === 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                `Confirm import (${importableCount})`
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </>
      )}

      {stage === "summary" && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Import complete
            </CardTitle>
            <CardDescription>
              {summary.year && summary.month
                ? `Period ${summary.year}-${String(summary.month).padStart(2, "0")}`
                : "Payroll import"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <Stat label="Imported" value={summary.imported} />
              <Stat label="Updated" value={summary.updated} />
              <Stat label="Skipped" value={summary.skipped} />
              <Stat label="Failed" value={summary.failed} />
            </div>
            <ul className="space-y-2 text-sm">
              {summary.rows.map((row) => (
                <li key={row.rowId}>
                  <span className="font-medium">{row.employeeName}</span>
                  {" — "}
                  <span className="capitalize">{row.outcome}</span>
                  {": "}
                  {row.message}
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={reset}>
              Import another workbook
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Amount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{formatCurrency(value)}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
