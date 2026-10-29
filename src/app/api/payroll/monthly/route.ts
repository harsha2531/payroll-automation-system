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

  const supabase = await createServerSupabaseClient();

  // Pull needed snapshot columns, employee status, payslip document path,
  // and the JSONB `calculation_metadata` that contains the payroll period.
  const { data, error } = await supabase
    .from("payroll_items")
    .select(`
      employee_id,
      employee_name_snapshot,
      employee_number_snapshot,
      gross_pay,
      net_pay,
      error_message,
      employees (status),
      payslip_documents (storage_path),
      calculation_metadata
    `)
    // Filter by the period stored inside calculation_metadata JSONB
    .eq("calculation_metadata->payrollPeriod->>year", year.toString())
    .eq("calculation_metadata->payrollPeriod->>month", month.toString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: PayrollRow[] = (data ?? []).map((r: any) => {
    const emp = r.employees || {};
    const doc = r.payslip_documents?.[0] || {};
    return {
      employeeId: r.employee_id,
      employeeName: r.employee_name_snapshot ?? "",
      employeeNumber: r.employee_number_snapshot ?? "",
      department: undefined,
      designation: undefined,
      grossPay: Number(r.gross_pay),
      netPay: Number(r.net_pay),
      payslipStatus: (emp.status ?? "pending") as PayrollRow["payslipStatus"],
      payslipUrl: doc.storage_path ?? null,
      errorMessage: r.error_message,
    };
  });

  return NextResponse.json(rows);
}

//////////////////////////////////////////////


// // src/app/api/payroll/monthly/route.ts
// import { NextResponse } from "next/server";
// import { PayrollRow } from "@/types/payroll-ui";
// import { createServerSupabaseClient } from "@/lib/supabase/server";

// export async function GET(request: Request) {
//   const url = new URL(request.url);
//   const yearParam = url.searchParams.get("year");
//   const monthParam = url.searchParams.get("month");

//   const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
//   const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

//   const supabase = await createServerSupabaseClient();

//   // Pull needed snapshot columns, employee status, and the payslip document storage_path.
//   const { data, error } = await supabase
//     .from("payroll_items")
//     .select(`
//       employee_id,
//       employee_name_snapshot,
//       employee_number_snapshot,
//       gross_pay,
//       net_pay,
//       error_message,
//       employees (status),
//       payslip_documents (storage_path)
//     `)
//     // Filter by the linked payroll run's year and month
//     .eq("payroll_runs.year", year)
//     .eq("payroll_runs.month", month);

//   if (error) {
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }

//   const rows: PayrollRow[] = (data ?? []).map((r: any) => {
//     const emp = r.employees || {};
//     const doc = r.payslip_documents?.[0] || {};
//     return {
//       employeeId: r.employee_id,
//       employeeName: r.employee_name_snapshot ?? "",
//       employeeNumber: r.employee_number_snapshot ?? "",
//       department: undefined,
//       designation: undefined,
//       grossPay: Number(r.gross_pay),
//       netPay: Number(r.net_pay),
//       // Use employee status as UI status (kept under payslipStatus name for compatibility).
//       payslipStatus: (emp.status ?? "pending") as PayrollRow["payslipStatus"],
//       // Map the storage_path from payslip_documents to the UI's payslipUrl field.
//       payslipUrl: doc.storage_path ?? null,
//       errorMessage: r.error_message,
//     };
//   });

//   return NextResponse.json(rows);
// }
