// src/app/api/payroll/job-status/route.ts
import { NextResponse } from "next/server";
import { getJobStatus } from "@/lib/payrollDataStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const status = getJobStatus(jobId);
  if (!status) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(status);
}

