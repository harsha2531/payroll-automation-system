// src/app/api/payroll/monthly/route.ts
import { NextResponse } from "next/server";
import { getPayrollRows } from "@/lib/payrollDataStore";
import { PayrollRow } from "@/types/payroll-ui";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  // Retrieve stored payroll rows for the selected period.
  const rows: PayrollRow[] = getPayrollRows(year, month);

  return NextResponse.json(rows);
}
