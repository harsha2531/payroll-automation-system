import { describe, it, expect } from "vitest";
import {
  MAX_XLSX_BYTES,
  validatePayrollUploadBuffer,
  validatePayrollUploadFile,
} from "@/services/payroll-file";

describe("Payroll upload file validation", () => {
  it("accepts an .xlsx file within the size limit", () => {
    const result = validatePayrollUploadFile({
      name: "July-2022.xlsx",
      size: 2048,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing names, empty files, and non-xlsx extensions", () => {
    expect(validatePayrollUploadFile({ name: "", size: 10 }).success).toBe(
      false
    );
    expect(
      validatePayrollUploadFile({ name: "sheet.xls", size: 10 }).error
    ).toMatch(/xlsx/i);
    expect(
      validatePayrollUploadFile({ name: "sheet.xlsx", size: 0 }).error
    ).toMatch(/empty/i);
    expect(
      validatePayrollUploadFile({
        name: "sheet.xlsx",
        size: MAX_XLSX_BYTES + 1,
      }).error
    ).toMatch(/10 MB/i);
  });

  it("rejects CSV and image MIME types", () => {
    expect(
      validatePayrollUploadFile({
        name: "sheet.xlsx",
        size: 100,
        type: "text/csv",
      }).success
    ).toBe(false);
    expect(
      validatePayrollUploadFile({
        name: "sheet.xlsx",
        size: 100,
        type: "image/png",
      }).success
    ).toBe(false);
  });

  it("rejects buffers that are not ZIP/Open XML workbooks", () => {
    expect(validatePayrollUploadBuffer(Buffer.from("")).success).toBe(false);
    expect(
      validatePayrollUploadBuffer(Buffer.from("not-an-excel-file")).error
    ).toMatch(/valid \.xlsx/i);
    expect(
      validatePayrollUploadBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))
        .success
    ).toBe(true);
  });
});
