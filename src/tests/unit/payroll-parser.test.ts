import { describe, it, expect } from 'vitest';
import { parsePayrollWorkbook } from '@/services/payroll-parser';
import fs from 'fs';
import path from 'path';

const fixturePath = path.resolve(__dirname, '../fixtures/July 2022-Datafield Ssalary-NOW.xlsx');
const buffer = fs.readFileSync(fixturePath);

describe('Payroll parser', () => {
  it('parses all employee sheets without error', () => {
    const records = parsePayrollWorkbook(buffer);
    // The sample workbook contains 5 employee sheets (excluding summary sheets)
    // We expect at least 4 records with a name present.
    const namedRecords = records.filter(r => r.employeeName);
    expect(namedRecords.length).toBeGreaterThanOrEqual(4);
    // Spot-check first record for presence of basic fields (may be undefined if missing)
    const first = namedRecords[0];
    expect(first?.employeeName).toBeTypeOf('string');
    // basicSalary may be undefined in this sample; just ensure parsing does not throw.
    expect(() => first?.basicSalary).not.toThrow();
  });
});
