import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { Result } from "@/types/common";
import type { Employee } from "@/types/payroll";
import {
  parsePayrollWorkbook,
  validatePayrollRecord,
  type PayrollRecord,
  type ValidationIssue,
} from "@/services/payroll-parser";
import {
  mapPayrollRecordToItem,
  parsePayrollMonth,
  preparePayrollBatch,
  toPayrollItemInsert,
  toPayrollRunInsert,
  type PreparedPayrollItem,
} from "@/services/payroll-mapper";
import { EmployeeRepository } from "@/repositories/employee.repository";
import {
  PayrollItemRepository,
  PayrollRunRepository,
} from "@/repositories/payroll.repository";
import {
  validatePayrollUploadBuffer,
  validatePayrollUploadFile,
  type UploadFileLike,
} from "@/services/payroll-file";
import type {
  ImportDisposition,
  ImportPreview,
  ImportPreviewRow,
  ImportRowCorrection,
  ImportSummary,
  ImportSummaryRow,
  ImportAmounts,
} from "@/features/payroll/import-types";

export type {
  ImportDisposition,
  ImportPreview,
  ImportPreviewRow,
  ImportRowCorrection,
  ImportSummary,
  ImportSummaryRow,
  ImportAmounts,
};

const PLACEHOLDER_EMAIL_RE = /@(company|payroll|imported)\.local$/i;

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isPlaceholderEmail(email: string): boolean {
  return !email || PLACEHOLDER_EMAIL_RE.test(email);
}

function sanitizeLocalPart(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
  return cleaned || "employee";
}

function amountsFromItem(item: PreparedPayrollItem): ImportAmounts {
  return {
    basicSalary: item.basicSalary,
    allowances: item.allowances,
    variablePayLabel: item.variablePayLabel,
    variablePayAmount: item.variablePayAmount,
    grossPay: item.grossPay,
    totalDeductions: item.totalDeductions,
    netPay: item.netPay,
    employerContributions: item.employerContributions,
  };
}

function overlayRecord(
  record: PayrollRecord,
  correction?: ImportRowCorrection
): PayrollRecord {
  if (!correction) return record;
  const correctedEpf =
    correction.epfNumber !== undefined
      ? correction.epfNumber.trim() ? correction.epfNumber.replace(/\D/g, "") : null
      : record.epfNumber;
  return {
    ...record,
    employeeName: correction.employeeName?.trim() || record.employeeName,
    employeeEmail: correction.email?.trim() || record.employeeEmail || record.companyEmail,
    employeeNumber: record.employeeNumber,
    epfNumber: correctedEpf,
    designation: correction.designation?.trim() || record.designation,
  };
}

function matchEmployee(
  record: PayrollRecord,
  employees: Employee[]
): { employee: Employee; identityMatch: ImportPreviewRow["identityMatch"] } | null {
  // 1. Match by EPF number if present (exact match or digits-only match)
  const epfDigits = (record.epfNumber || record.employeeNumber || "").replace(/\D/g, "");
  const epfRaw = normalizeKey(record.epfNumber || record.employeeNumber);
  if (epfDigits || epfRaw) {
    const hits = employees.filter((e) => {
      const eDigits = (e.epfNumber || "").replace(/\D/g, "");
      const eRaw = normalizeKey(e.epfNumber);
      return (
        (epfDigits && eDigits && epfDigits === eDigits) ||
        (epfRaw && eRaw && epfRaw === eRaw)
      );
    });
    if (hits.length === 1) return { employee: hits[0], identityMatch: "epf" };
    if (hits.length > 1) return null;
  }

  // 2. Match by employee number if present
  const numberKey = normalizeKey(record.employeeNumber);
  if (numberKey) {
    const hits = employees.filter(
      (e) => normalizeKey(e.employeeNumber) === numberKey
    );
    if (hits.length === 1) {
      return { employee: hits[0], identityMatch: "employee_number" };
    }
  }

  // 3. Match by full name
  const nameKey = normalizeKey(record.employeeName);
  if (nameKey) {
    const hits = employees.filter((e) => normalizeKey(e.fullName) === nameKey);
    if (hits.length === 1) {
      return { employee: hits[0], identityMatch: "name" };
    }
  }

  // 4. Match by email
  const email = normalizeKey(record.employeeEmail);
  if (email && !isPlaceholderEmail(email)) {
    const hits = employees.filter((e) => normalizeKey(e.email) === email);
    if (hits.length === 1) return { employee: hits[0], identityMatch: "email" };
  }

  return null;
}

function getMaxSequentialNumber(employees: Employee[], prefix: "PS" | "CS"): number {
  let max = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");
  for (const emp of employees) {
    const m = emp.employeeNumber?.match(regex);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  }
  return max;
}

function buildDisposition(params: {
  issues: ValidationIssue[];
  year: number | null;
  month: number | null;
  existing: Employee | null;
  duplicatePeriod: boolean;
  ambiguousMatch: boolean;
}): ImportDisposition {
  const hasError =
    params.issues.some((i) => i.severity === "error") ||
    !params.year ||
    !params.month ||
    params.ambiguousMatch;

  if (hasError) return "reject";
  if (params.duplicatePeriod) return "skip_duplicate_period";
  if (params.existing) {
    const missingEpf = !params.existing.epfNumber;
    const missingDesignation = !params.existing.designation;
    if (missingEpf || missingDesignation) return "fill_missing_employee_fields";
    return "import_existing_employee";
  }
  return "import_new_employee";
}

function summarizePreview(rows: ImportPreviewRow[]): ImportPreview["counts"] {
  return {
    importable: rows.filter(
      (r) =>
        r.included &&
        (r.disposition === "import_new_employee" ||
          r.disposition === "import_existing_employee" ||
          r.disposition === "fill_missing_employee_fields")
    ).length,
    skipped: rows.filter((r) => r.disposition === "skip_duplicate_period").length,
    rejected: rows.filter((r) => r.disposition === "reject").length,
    willUpdate: rows.filter(
      (r) =>
        r.included &&
        (r.disposition === "fill_missing_employee_fields" ||
          r.applyEmployeeUpdates)
    ).length,
  };
}

export function parseWorkbookRecords(buffer: Buffer): Result<PayrollRecord[]> {
  const bufferCheck = validatePayrollUploadBuffer(buffer);
  if (!bufferCheck.success) {
    return Result.err(bufferCheck.error ?? "Invalid workbook.");
  }

  try {
    const records = parsePayrollWorkbook(buffer);
    if (!records.length) {
      return Result.err("No employee payroll sheets were found in the workbook.");
    }
    return Result.ok(records);
  } catch {
    return Result.err(
      "The workbook could not be parsed. Confirm it is a valid .xlsx file."
    );
  }
}

async function listAllEmployees(
  supabase: SupabaseClient<Database>
): Promise<Employee[]> {
  const first = await EmployeeRepository.listEmployees(supabase, {
    page: 1,
    pageSize: 100,
  });
  if (!first.success) return [];
  const employees = [...first.data.items];
  for (let page = 2; page <= first.data.totalPages; page++) {
    const extra = await EmployeeRepository.listEmployees(supabase, {
      page,
      pageSize: 100,
    });
    if (extra.success) employees.push(...extra.data.items);
  }
  return employees;
}

export const PayrollImportService = {
  validateUpload(file: UploadFileLike, buffer?: Buffer): Result<true> {
    const fileCheck = validatePayrollUploadFile(file);
    if (!fileCheck.success) {
      return Result.err(fileCheck.error ?? "Invalid file.");
    }
    if (buffer) {
      const bufferCheck = validatePayrollUploadBuffer(buffer);
      if (!bufferCheck.success) {
        return Result.err(bufferCheck.error ?? "Invalid workbook.");
      }
    }
    return Result.ok(true);
  },

  async buildPreview(
    supabase: SupabaseClient<Database>,
    buffer: Buffer,
    sourceFilename: string
  ): Promise<Result<ImportPreview>> {
    const parsed = parseWorkbookRecords(buffer);
    if (!parsed.success) {
      return Result.err(parsed.error);
    }
    return PayrollImportService.buildPreviewFromRecords(
      supabase,
      parsed.data,
      sourceFilename
    );
  },

  async buildPreviewFromRecords(
    supabase: SupabaseClient<Database>,
    records: PayrollRecord[],
    sourceFilename: string,
    corrections: ImportRowCorrection[] = []
  ): Promise<Result<ImportPreview>> {
    const correctionByKey = new Map(
      corrections.map((c) => [
        `${c.sourceSheetName}::${c.originalEmployeeName}`,
        c,
      ])
    );

    const employees = await listAllEmployees(supabase);
    const overlayed = records.map((record) => {
      const originalName = (record.employeeName || "").trim();
      const key = `${record.sourceSheetName || ""}::${originalName}`;
      return overlayRecord(record, correctionByKey.get(key));
    });

    let nextPsSeq = getMaxSequentialNumber(employees, "PS");
    let nextCsSeq = getMaxSequentialNumber(employees, "CS");

    // Match each record and pre-assign employee numbers
    const matches = overlayed.map((record) => {
      const match = matchEmployee(record, employees);
      if (match?.employee) {
        record.employeeNumber = match.employee.employeeNumber;
      } else if (!record.employeeNumber) {
        if (record.staffCategory === "contract") {
          nextCsSeq++;
          record.employeeNumber = `CS-${String(nextCsSeq).padStart(4, "0")}`;
        } else {
          nextPsSeq++;
          record.employeeNumber = `PS-${String(nextPsSeq).padStart(4, "0")}`;
        }
      }
      return match;
    });

    const periods = overlayed
      .map((r) => parsePayrollMonth(r.payrollMonth))
      .filter((p): p is { year: number; month: number } => Boolean(p));
    const uniquePeriods = new Set(periods.map((p) => `${p.year}-${p.month}`));
    const mixedPeriods = uniquePeriods.size > 1;
    const primaryPeriod = periods[0] ?? null;
    const workbookErrors: string[] = [];

    if (mixedPeriods) {
      workbookErrors.push(
        "The workbook contains more than one payroll period. Import one period at a time."
      );
    }

    const periodRuns =
      primaryPeriod && !mixedPeriods
        ? await PayrollRunRepository.findByPeriod(
          supabase,
          primaryPeriod.year,
          primaryPeriod.month
        )
        : [];
    const existingItems = await PayrollItemRepository.listByRunIds(
      supabase,
      periodRuns.map((r) => r.id)
    );
    const employeesWithPeriod = new Set(existingItems.map((i) => i.employeeId));

    const seenEpf = new Map<string, string>();
    const batch = preparePayrollBatch(overlayed, {
      runOptions: { sourceFilename },
    });

    const rows: ImportPreviewRow[] = overlayed.map((record, index) => {
      const originalName = (records[index].employeeName || "").trim();
      const sheet =
        record.sourceSheetName || records[index].sourceSheetName || "";
      const key = `${sheet}::${originalName}`;
      const correction = correctionByKey.get(key);
      const validated = validatePayrollRecord(record);
      const issues = [...validated.issues];
      const period = parsePayrollMonth(record.payrollMonth);
      const item = batch.items[index];
      const warnings = item.calculationMetadata.discrepancies ?? [];

      const epf = normalizeKey(record.epfNumber);
      if (epf) {
        const first = seenEpf.get(epf);
        if (first) {
          issues.push({
            severity: "error",
            field: "epfNumber",
            message: `Duplicate EPF number in this workbook (also on ${first}).`,
          });
        } else {
          seenEpf.set(
            epf,
            record.employeeName || sheet || `row ${index + 1}`
          );
        }
      }

      const match = matches[index];
      const ambiguous =
        Boolean(epf) &&
        employees.filter((e) => normalizeKey(e.epfNumber) === epf).length > 1;

      if (ambiguous) {
        issues.push({
          severity: "error",
          field: "epfNumber",
          message:
            "Multiple employees share this EPF number. Resolve the master records first.",
        });
      }

      const existing = match?.employee ?? null;
      const duplicatePeriod = Boolean(
        existing && employeesWithPeriod.has(existing.id)
      );

      const disposition = buildDisposition({
        issues,
        year: period?.year ?? null,
        month: period?.month ?? null,
        existing,
        duplicatePeriod,
        ambiguousMatch: ambiguous,
      });

      const included =
        correction?.included ??
        (disposition !== "reject" && disposition !== "skip_duplicate_period");

      return {
        rowId: `${index}:${sheet}`,
        sourceSheetName: sheet,
        originalEmployeeName: originalName,
        employeeName: record.employeeName || "",
        email: record.employeeEmail || record.companyEmail || existing?.email || "",
        epfNumber: record.epfNumber || existing?.epfNumber || "",
        designation: record.designation || existing?.designation || "",
        employeeNumber: record.employeeNumber || item.employeeNumberSnapshot,
        periodLabel: record.payrollMonth || "",
        year: period?.year ?? null,
        month: period?.month ?? null,
        amounts: amountsFromItem(item),
        issues,
        warnings,
        disposition,
        included,
        applyEmployeeUpdates: correction?.applyEmployeeUpdates ?? false,
        existingEmployee: existing
          ? {
            id: existing.id,
            employeeNumber: existing.employeeNumber,
            fullName: existing.fullName,
            email: existing.email,
            epfNumber: existing.epfNumber,
            designation: existing.designation,
          }
          : null,
        duplicatePeriod,
        identityMatch: match?.identityMatch ?? "none",
      };
    });

    return Result.ok({
      sourceFilename,
      year: mixedPeriods ? null : (primaryPeriod?.year ?? null),
      month: mixedPeriods ? null : (primaryPeriod?.month ?? null),
      periodLabel: mixedPeriods ? null : overlayed[0]?.payrollMonth ?? null,
      mixedPeriods,
      workbookErrors,
      warnings: batch.warnings,
      rows,
      counts: summarizePreview(rows),
    });
  },

  async confirmImport(
    supabase: SupabaseClient<Database>,
    input: {
      buffer: Buffer;
      sourceFilename: string;
      corrections: ImportRowCorrection[];
      createdBy?: string | null;
    }
  ): Promise<Result<ImportSummary>> {
    const parsed = parseWorkbookRecords(input.buffer);
    if (!parsed.success) {
      return Result.err(parsed.error);
    }

    const previewResult = await PayrollImportService.buildPreviewFromRecords(
      supabase,
      parsed.data,
      input.sourceFilename,
      input.corrections
    );
    if (!previewResult.success) {
      return Result.err(previewResult.error);
    }

    const preview = previewResult.data;
    if (preview.mixedPeriods) {
      return Result.err(
        preview.workbookErrors[0] ?? "Mixed payroll periods."
      );
    }
    if (!preview.year || !preview.month) {
      return Result.err(
        "A payroll period could not be determined from the workbook."
      );
    }

    const summaryRows: ImportSummaryRow[] = [];
    let createdRunId: string | null = null;
    let insertedItemRunId: string | null = null;

    const rollback = async () => {
      if (insertedItemRunId && createdRunId === insertedItemRunId) {
        await PayrollItemRepository.deleteByRunId(supabase, insertedItemRunId);
        await PayrollRunRepository.deleteRun(supabase, createdRunId);
      } else if (createdRunId && !insertedItemRunId) {
        await PayrollRunRepository.deleteRun(supabase, createdRunId);
      }
    };

    try {
      const itemsToInsert: Array<{
        row: ImportPreviewRow;
        employeeId: string;
        record: PayrollRecord;
        updatedMaster: boolean;
      }> = [];

      for (let recordIndex = 0; recordIndex < preview.rows.length; recordIndex++) {
        const row = preview.rows[recordIndex];
        const correction = input.corrections.find(
          (c) =>
            c.sourceSheetName === row.sourceSheetName &&
            c.originalEmployeeName === row.originalEmployeeName
        );
        const sourceRecord = overlayRecord(parsed.data[recordIndex], correction);

        if (!row.included) {
          summaryRows.push({
            rowId: row.rowId,
            employeeName: row.employeeName,
            outcome: "skipped",
            message: "Excluded from this import.",
          });
          continue;
        }

        if (row.disposition === "reject") {
          summaryRows.push({
            rowId: row.rowId,
            employeeName: row.employeeName,
            outcome: "failed",
            message:
              row.issues.find((i) => i.severity === "error")?.message ??
              "Record has blocking validation errors.",
          });
          continue;
        }

        if (row.disposition === "skip_duplicate_period") {
          summaryRows.push({
            rowId: row.rowId,
            employeeName: row.employeeName,
            outcome: "skipped",
            message: `Payroll already exists for ${preview.year}-${String(preview.month).padStart(2, "0")}. Existing snapshot was not changed.`,
          });
          continue;
        }

        const employeeNumber =
          (row.employeeNumber || sourceRecord.employeeNumber || "").trim() ||
          (sourceRecord.staffCategory === "contract"
            ? `CS-${String(recordIndex + 1).padStart(4, "0")}`
            : `PS-${String(recordIndex + 1).padStart(4, "0")}`);

        let employeeId = row.existingEmployee?.id ?? null;
        let updatedMaster = false;

        if (!employeeId) {
          // Check against the "employee_number" in the table
          const existingByNumber = await EmployeeRepository.findByEmployeeNumber(
            supabase,
            employeeNumber
          );

          if (existingByNumber) {
            // If it is already saved, do not add it as a new employee
            employeeId = existingByNumber.id;
          } else {
            // Add the record only if it does not already exist
            const email =
              (row.email || sourceRecord.employeeEmail || sourceRecord.companyEmail || "").trim() ||
              `${sanitizeLocalPart(employeeNumber)}@imported.local`;

            const created = await EmployeeRepository.createEmployee(supabase, {
              employeeNumber,
              fullName: (sourceRecord.employeeName || row.employeeName).trim(),
              email,
              designation: sourceRecord.designation || row.designation || null,
              epfNumber: row.epfNumber || sourceRecord.epfNumber || null,
              status: "active",
            });

            if (!created.success) {
              summaryRows.push({
                rowId: row.rowId,
                employeeName: row.employeeName,
                outcome: "failed",
                message: created.error,
              });
              continue;
            }

            employeeId = created.data.id;
            await EmployeeRepository.upsertPayrollDetails(supabase, employeeId, {
              basicSalary: row.amounts.basicSalary,
              allowances: row.amounts.allowances,
              variablePayLabel: row.amounts.variablePayLabel,
              variablePayAmount: row.amounts.variablePayAmount,
              effectiveFrom: `${preview.year}-${String(preview.month).padStart(2, "0")}-01`,
            });
          }
        } else {
          const existing = row.existingEmployee;
          const fill: {
            epfNumber?: string | null;
            designation?: string | null;
            email?: string;
            fullName?: string;
          } = {};

          if (
            existing &&
            !existing.epfNumber &&
            (row.epfNumber || sourceRecord.epfNumber)
          ) {
            fill.epfNumber = row.epfNumber || sourceRecord.epfNumber;
          }
          if (
            existing &&
            !existing.designation &&
            (sourceRecord.designation || row.designation)
          ) {
            fill.designation = sourceRecord.designation || row.designation;
          }

          if (row.applyEmployeeUpdates && existing) {
            fill.fullName = (
              sourceRecord.employeeName || row.employeeName
            ).trim();
            const candEmail = (row.email || sourceRecord.employeeEmail || sourceRecord.companyEmail || "").trim();
            if (candEmail && !isPlaceholderEmail(candEmail)) {
              fill.email = candEmail.toLowerCase();
            }
            if (sourceRecord.designation || row.designation) {
              fill.designation = sourceRecord.designation || row.designation;
            }
            if (row.epfNumber || sourceRecord.epfNumber) {
              fill.epfNumber = row.epfNumber || sourceRecord.epfNumber;
            }
          }

          if (Object.keys(fill).length > 0) {
            const updated = await EmployeeRepository.updateEmployee(
              supabase,
              employeeId,
              fill
            );
            if (!updated.success) {
              summaryRows.push({
                rowId: row.rowId,
                employeeName: row.employeeName,
                outcome: "failed",
                message: updated.error,
              });
              continue;
            }
            updatedMaster = true;
          }
        }

        itemsToInsert.push({
          row,
          employeeId,
          record: sourceRecord,
          updatedMaster,
        });
      }

      if (itemsToInsert.length === 0) {
        return Result.ok(buildSummary(preview.year, preview.month, null, summaryRows));
      }

      const periodRuns = await PayrollRunRepository.findByPeriod(
        supabase,
        preview.year,
        preview.month
      );
      let run =
        periodRuns.find((r) => r.sequenceNumber === 1) ?? periodRuns[0] ?? null;

      if (!run) {
        const prepared = preparePayrollBatch(
          itemsToInsert.map((q) => q.record),
          {
            runOptions: {
              sourceFilename: input.sourceFilename,
              year: preview.year,
              month: preview.month,
            },
          }
        );
        const createdRun = await PayrollRunRepository.createRun(
          supabase,
          toPayrollRunInsert(prepared.run, {
            created_by: input.createdBy ?? null,
            status: "calculated",
            sequence_number: 1,
            run_type: "regular",
          })
        );
        if (!createdRun.success) {
          return Result.err(createdRun.error);
        }
        run = createdRun.data;
        createdRunId = run.id;
      }

      const inserts = itemsToInsert.map(({ row, employeeId, record }) => {
        const item = mapPayrollRecordToItem(record, {
          payrollRunId: run!.id,
          employeeId,
          employeeMapping: {
            id: employeeId,
            employeeNumber:
              row.existingEmployee?.employeeNumber || row.employeeNumber,
            fullName: record.employeeName || row.employeeName,
            email: row.email || record.employeeEmail || record.companyEmail || "",
            designation: record.designation || row.designation,
          },
        });
        return toPayrollItemInsert(item, run!.id, employeeId);
      });

      const inserted = await PayrollItemRepository.createItems(supabase, inserts);
      if (!inserted.success) {
        await rollback();
        return Result.err(inserted.error);
      }
      insertedItemRunId = run.id;

      const allItems = await PayrollItemRepository.listByRunIds(supabase, [
        run.id,
      ]);
      await PayrollRunRepository.updateRunStatus(supabase, run.id, run.status, {
        total_employees: allItems.length,
        total_gross_pay: round2(
          allItems.reduce((s, i) => s + Number(i.grossPay), 0)
        ),
        total_deductions: round2(
          allItems.reduce((s, i) => s + Number(i.totalDeductions), 0)
        ),
        total_net_pay: round2(
          allItems.reduce((s, i) => s + Number(i.netPay), 0)
        ),
        source_filename: input.sourceFilename,
      });

      for (const queued of itemsToInsert) {
        summaryRows.push({
          rowId: queued.row.rowId,
          employeeName: queued.row.employeeName,
          outcome: queued.updatedMaster ? "updated" : "imported",
          message: queued.updatedMaster
            ? "Employee details filled or updated; monthly snapshot saved."
            : queued.row.existingEmployee
              ? "Existing employee matched; monthly snapshot saved."
              : "New employee and monthly snapshot saved.",
        });
      }

      return Result.ok(
        buildSummary(preview.year, preview.month, run.id, summaryRows)
      );
    } catch (err) {
      await rollback();
      return Result.err(
        err instanceof Error ? err.message : "Import failed unexpectedly."
      );
    }
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildSummary(
  year: number | null,
  month: number | null,
  payrollRunId: string | null,
  rows: ImportSummaryRow[]
): ImportSummary {
  return {
    payrollRunId,
    year,
    month,
    imported: rows.filter((r) => r.outcome === "imported").length,
    updated: rows.filter((r) => r.outcome === "updated").length,
    skipped: rows.filter((r) => r.outcome === "skipped").length,
    failed: rows.filter((r) => r.outcome === "failed").length,
    rows,
  };
}

async function allocateEmployeeNumber(
  supabase: SupabaseClient<Database>,
  preferred: string
): Promise<string> {
  const base = preferred.trim() || "EMP-001";
  const existing = await EmployeeRepository.findByEmployeeNumber(supabase, base);
  if (!existing) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    const hit = await EmployeeRepository.findByEmployeeNumber(
      supabase,
      candidate
    );
    if (!hit) return candidate;
  }
  return `${base}-${Date.now()}`;
}
