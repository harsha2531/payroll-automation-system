// src/app/api/payroll/process/route.ts
import { NextResponse } from "next/server";
import { startProcessing } from "@/lib/payrollDataStore";

export async function POST(request: Request) {
  const { year, month } = await request.json();
  if (typeof year !== "number" || typeof month !== "number") {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const job = startProcessing(year, month);
  return NextResponse.json({ jobId: job.jobId });
}

