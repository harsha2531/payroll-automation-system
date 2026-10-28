// src/app/api/payroll/[employeeId]/retry-email/route.ts
import { NextResponse } from "next/server";
import { retryEmail } from "@/lib/payrollDataStore";

export async function POST(request: Request, { params }: { params: { employeeId: string } }) {
  const { employeeId } = params;
  const { year, month } = await request.json();
  if (typeof year !== "number" || typeof month !== "number") {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  try {
    retryEmail(employeeId, year, month);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

