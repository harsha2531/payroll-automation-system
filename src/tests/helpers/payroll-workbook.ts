import * as XLSX from "xlsx";

export interface SamplePayslipInput {
  sheetName: string;
  employeeName: string;
  designation?: string;
  epfNumber?: string;
  payrollMonth?: string;
  basicSalary: number;
  travellingAllowance?: number;
  overtime?: number;
  grossSalary: number;
  epf8?: number;
  stampDuty?: number;
  totalDeductions: number;
  netSalary: number;
  employerEpf12?: number;
  employerEtf3?: number;
}

export function buildPayslipAoA(input: SamplePayslipInput): unknown[][] {
  return [
    ["Datafield Solutions (Pvt) Ltd"],
    ["No. 1, Sample Road, Colombo"],
    ["payroll@datafield.local"],
    ["Name:", input.employeeName],
    ["Designation:", input.designation ?? "Engineer"],
    ["EPF No:", input.epfNumber ?? ""],
    ["Month:", input.payrollMonth ?? "July 2022"],
    ["Basic Salary", input.basicSalary],
    ["Travelling Allowance", input.travellingAllowance ?? 0],
    ["Over Time", input.overtime ?? 0],
    ["Gross Salary", input.grossSalary],
    ["EPF 8%", input.epf8 ?? 0],
    ["Stamp Duty", input.stampDuty ?? 0],
    ["Total Deductions", input.totalDeductions],
    ["Net Salary", input.netSalary],
    ["EPF 12%", input.employerEpf12 ?? 0],
    ["ETF 3%", input.employerEtf3 ?? 0],
  ];
}

export function buildPayrollWorkbookBuffer(
  payslips: SamplePayslipInput[]
): Buffer {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([["Summary"], ["Ignore this sheet"]]);
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  for (const payslip of payslips) {
    const sheet = XLSX.utils.aoa_to_sheet(buildPayslipAoA(payslip));
    XLSX.utils.book_append_sheet(wb, sheet, payslip.sheetName.slice(0, 31));
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export const SAMPLE_JANE: SamplePayslipInput = {
  sheetName: "Jane Doe",
  employeeName: "Jane Doe",
  designation: "Software Engineer",
  epfNumber: "EPF-123",
  payrollMonth: "July 2022",
  basicSalary: 50000,
  travellingAllowance: 10000,
  overtime: 2500,
  grossSalary: 80000,
  epf8: 4000,
  stampDuty: 25,
  totalDeductions: 4025,
  netSalary: 75975,
  employerEpf12: 6000,
  employerEtf3: 1500,
};

export const SAMPLE_JOHN: SamplePayslipInput = {
  sheetName: "John Smith",
  employeeName: "John Smith",
  designation: "Accountant",
  epfNumber: "EPF-456",
  payrollMonth: "July 2022",
  basicSalary: 40000,
  travellingAllowance: 5000,
  overtime: 0,
  grossSalary: 45000,
  epf8: 3200,
  stampDuty: 25,
  totalDeductions: 3225,
  netSalary: 41775,
  employerEpf12: 4800,
  employerEtf3: 1200,
};
