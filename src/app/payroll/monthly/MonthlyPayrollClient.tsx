// src/app/payroll/monthly/MonthlyPayrollClient.tsx

"use client";

import { useState, useEffect } from "react";
import { fetchPayrollRows, startPayrollProcessing, retryPdfGeneration, retryEmailDelivery } from "@/services/payroll-ui.service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCcw, Loader2, FileCheck, Mail } from "lucide-react";

export type PayslipStatus = "pending" | "generated" | "emailed" | "failed";

export interface PayrollRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department?: string | null;
  designation?: string | null;
  grossPay: number;
  netPay: number;
  payslipStatus: PayslipStatus;
  payslipUrl?: string | null;
  errorMessage?: string | null;
}

export default function MonthlyPayrollClient() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Load payroll rows when year/month change
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchPayrollRows(year, month);
        setRows(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, month]);

  async function handleStartProcessing() {
    setLoading(true);
    try {
      const { jobId } = await startPayrollProcessing(year, month);
      setProcessingJobId(jobId);
      const interval = setInterval(async () => {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/payroll/job-status?jobId=${jobId}`);
        const { status } = await resp.json();
        if (status === "completed" || status === "failed") {
          clearInterval(interval);
          setProcessingJobId(null);
          const refreshed = await fetchPayrollRows(year, month);
          setRows(refreshed);
        }
      }, 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryPdf(id: string) {
    await retryPdfGeneration(id, year, month);
    const refreshed = await fetchPayrollRows(year, month);
    setRows(refreshed);
  }

  async function handleRetryEmail(id: string) {
    await retryEmailDelivery(id, year, month);
    const refreshed = await fetchPayrollRows(year, month);
    setRows(refreshed);
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="border-2 border-dashed shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Monthly Payroll</h1>
            <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">Processing</Badge>
          </div>
          <CardDescription>Select month/year, review salaries and trigger processing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Year:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return (<option key={y} value={y}>{y}</option>);
              })}
            </select>
            <label className="text-sm font-medium">Month:</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <Button onClick={handleStartProcessing} disabled={loading || !!processingJobId}>
              {processingJobId ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {processingJobId ? "Processing…" : "Start Processing"}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-4 text-center"><Loader2 className="animate-spin inline-block mr-2" />Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No payroll data for this period.</td></tr>
                ) : (
                  rows.map(row => (
                    <tr key={row.employeeId} className="border-b">
                      <td className="px-3 py-2">{row.employeeName}</td>
                      <td className="px-3 py-2">{row.employeeNumber}</td>
                      <td className="px-3 py-2 text-right">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(row.grossPay)}</td>
                      <td className="px-3 py-2 text-right">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(row.netPay)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={row.payslipStatus === "generated" ? "default" : row.payslipStatus === "emailed" ? "secondary" : row.payslipStatus === "failed" ? "destructive" : "outline"}>
                          {row.payslipStatus.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center space-x-1">
                        {row.payslipStatus === "generated" && row.payslipUrl && (
                          <a href={row.payslipUrl} target="_blank" rel="noopener" className="text-primary hover:underline">
                            <FileCheck className="inline h-4 w-4" />
                          </a>
                        )}
                        {row.payslipStatus === "failed" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleRetryPdf(row.employeeId)} title="Retry PDF">
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleRetryEmail(row.employeeId)} title="Retry Email">
                              <Mail className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
