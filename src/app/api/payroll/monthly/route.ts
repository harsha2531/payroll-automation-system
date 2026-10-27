// src/app/api/payroll/monthly/route.ts
import { NextResponse } from "next/server";
import { PayrollRow } from "@/types/payroll-ui";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");

  // TODO: Replace with real DB query filtering by year/month
  const sample: PayrollRow[] = [
    {
      employeeId: "e1",
      employeeName: "Alice Johnson",
      employeeNumber: "001",
      department: "Finance",
      designation: "Accountant",
      grossPay: 5000,
      netPay: 4200,
      payslipStatus: "pending",
    },
    {
      employeeId: "e2",
      employeeName: "Bob Smith",
      employeeNumber: "002",
      department: "HR",
      designation: "Recruiter",
      grossPay: 4800,
      netPay: 4100,
      payslipStatus: "generated",
      payslipUrl: "https://example.com/payslip/bob.pdf",
    },
  ];

  // You could filter based on year/month here if you had real data
  return NextResponse.json(sample);
}
