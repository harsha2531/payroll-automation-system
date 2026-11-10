// src/app/api/payroll/monthly/route.ts
import { NextResponse } from "next/server";
import { getPayrollRows } from "@/lib/payrollDataStore";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  try {
    const supabase = createAdminClient();
    const rows = await getPayrollRows(year, month, supabase);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
