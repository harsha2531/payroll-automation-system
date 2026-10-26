/**
 * Server-side Excel workbook upload checks.
 * Safe to unit-test without a database.
 */

export const MAX_XLSX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_XLSX_EXTENSION = ".xlsx";

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

export interface UploadFileLike {
  name: string;
  size: number;
  type?: string | null;
}

export interface FileValidationResult {
  success: boolean;
  error?: string;
}

function hasZipSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export function validatePayrollUploadFile(
  file: UploadFileLike
): FileValidationResult {
  const name = (file.name || "").trim();
  if (!name) {
    return { success: false, error: "A file name is required." };
  }

  const lower = name.toLowerCase();
  if (!lower.endsWith(ALLOWED_XLSX_EXTENSION)) {
    return {
      success: false,
      error: "Only .xlsx workbooks are supported.",
    };
  }

  if (file.size <= 0) {
    return { success: false, error: "The uploaded file is empty." };
  }

  if (file.size > MAX_XLSX_BYTES) {
    return {
      success: false,
      error: `The file exceeds the ${MAX_XLSX_BYTES / (1024 * 1024)} MB size limit.`,
    };
  }

  const mime = (file.type || "").toLowerCase();
  if (
    mime &&
    (mime.startsWith("text/") ||
      mime.startsWith("image/") ||
      mime.includes("csv") ||
      mime.includes("ms-excel"))
  ) {
    return {
      success: false,
      error: "Only .xlsx workbooks are supported.",
    };
  }

  if (mime && !XLSX_MIME_TYPES.has(mime) && !mime.includes("spreadsheet")) {
    return {
      success: false,
      error: "Only .xlsx workbooks are supported.",
    };
  }

  return { success: true };
}

export function validatePayrollUploadBuffer(
  buffer: Buffer
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { success: false, error: "The uploaded file is empty." };
  }
  if (buffer.length > MAX_XLSX_BYTES) {
    return {
      success: false,
      error: `The file exceeds the ${MAX_XLSX_BYTES / (1024 * 1024)} MB size limit.`,
    };
  }
  if (!hasZipSignature(buffer)) {
    return {
      success: false,
      error: "The file is not a valid .xlsx workbook.",
    };
  }
  return { success: true };
}
