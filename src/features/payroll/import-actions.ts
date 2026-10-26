"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth.service";
import { PayrollImportService } from "@/services/payroll-import.service";
import type {
  ImportPreview,
  ImportRowCorrection,
  ImportSummary,
} from "@/features/payroll/import-types";

export interface PayrollImportActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function requireAdminForImport<T = never>(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
    }
  | { ok: false; result: PayrollImportActionResult<T> }
> {
  const supabase = await createClient();
  const { user, profile, isAdmin } =
    await AuthService.getCurrentUserWithProfile(supabase);

  if (!user || !profile) {
    return {
      ok: false,
      result: {
        success: false,
        error: "You must be signed in to import payroll.",
      },
    };
  }

  if (!isAdmin) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Permission denied: Only administrators can import payroll.",
      },
    };
  }

  return { ok: true, supabase, userId: user.id };
}

async function readWorkbookFromFormData(
  formData: FormData
): Promise<PayrollImportActionResult<{ buffer: Buffer; filename: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Choose an .xlsx workbook to upload." };
  }

  const check = PayrollImportService.validateUpload({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!check.success) {
    return { success: false, error: check.error };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const bufferCheck = PayrollImportService.validateUpload(
    { name: file.name, size: file.size, type: file.type },
    bytes
  );
  if (!bufferCheck.success) {
    return { success: false, error: bufferCheck.error };
  }

  return { success: true, data: { buffer: bytes, filename: file.name } };
}

function parseCorrections(
  raw: FormDataEntryValue | null
): ImportRowCorrection[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as ImportRowCorrection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function previewPayrollImportAction(
  formData: FormData
): Promise<PayrollImportActionResult<ImportPreview>> {
  const auth = await requireAdminForImport<ImportPreview>();
  if (!auth.ok) return auth.result;

  const fileResult = await readWorkbookFromFormData(formData);
  if (!fileResult.success || !fileResult.data) {
    return { success: false, error: fileResult.error };
  }

  const preview = await PayrollImportService.buildPreview(
    auth.supabase as never,
    fileResult.data.buffer,
    fileResult.data.filename
  );

  if (!preview.success) {
    return { success: false, error: preview.error };
  }

  return { success: true, data: preview.data };
}

export async function confirmPayrollImportAction(
  formData: FormData
): Promise<PayrollImportActionResult<ImportSummary>> {
  const auth = await requireAdminForImport<ImportSummary>();
  if (!auth.ok) return auth.result;

  const fileResult = await readWorkbookFromFormData(formData);
  if (!fileResult.success || !fileResult.data) {
    return { success: false, error: fileResult.error };
  }

  const corrections = parseCorrections(formData.get("corrections"));
  const result = await PayrollImportService.confirmImport(
    auth.supabase as never,
    {
      buffer: fileResult.data.buffer,
      sourceFilename: fileResult.data.filename,
      corrections,
      createdBy: auth.userId,
    }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/employees");
  revalidatePath("/payroll");
  revalidatePath("/payroll/import");
  return { success: true, data: result.data };
}
