// src/app/api/payroll/monthly/route.ts
import { NextResponse } from "next/server";
import { PayrollRow } from "@/types/payroll-ui";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  // Use a server‑side Supabase client (no service‑role key exposed to the browser)
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("payrolls")
    .select(
      `employee_id,
       employee_name,
       employee_number,
       department,
       designation,
       gross_pay,
       net_pay,
       payslip_status,
       payslip_url,
       error_message`
    )
    .eq("year", year)
    .eq("month", month);

  if (error) {
    // Return a proper error response – the UI will show an error state.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: PayrollRow[] = (data ?? []).map((r: any) => ({
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeNumber: r.employee_number,
    department: r.department,
    designation: r.designation,
    grossPay: Number(r.gross_pay),
    netPay: Number(r.net_pay),
    payslipStatus: r.payslip_status as PayrollRow["payslipStatus"],
    payslipUrl: r.payslip_url,
    errorMessage: r.error_message,
  }));

  return NextResponse.json(rows);
}
