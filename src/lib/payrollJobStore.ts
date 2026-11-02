// src/lib/payrollJobStore.ts
// Simple in‑memory store for demo payroll processing jobs.
// In a real system this would be a persistent queue/database.

export interface PayrollJob {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  // Optional error for failed jobs
  error?: string;
}

const jobs = new Map<string, PayrollJob>();

export function createJob(): PayrollJob {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const job: PayrollJob = { jobId, status: "queued" };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): PayrollJob | undefined {
  return jobs.get(jobId);
}

