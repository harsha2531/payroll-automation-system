// src/app/payroll/monthly/MonthlyPayrollClient.tsx

"use client";

import { useState, useEffect } from "react";
import { fetchPayrollRows, startPayrollProcessing, retryPdfGeneration, retryEmailDelivery } from "@/services/payroll-ui.service";
import { PayrollRow } from "@/types/payroll-ui";
import { Card, CardHeader, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCcw, Loader2, FileCheck, Mail, Download } from "lucide-react";


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
    try {
      await retryPdfGeneration(id, year, month);
      const refreshed = await fetchPayrollRows(year, month);
      setRows(refreshed);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRetryEmail(id: string) {
    try {
      await retryEmailDelivery(id, year, month);
      const refreshed = await fetchPayrollRows(year, month);
      setRows(refreshed);
    } catch (e) {
      console.error(e);
    }
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
                const y = new Date().getFullYear() - 4 + i;
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
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant={
                              row.payslipStatus === "emailed"
                                ? "secondary"
                                : row.payslipStatus === "generated"
                                ? "default"
                                : row.payslipStatus === "failed"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {row.payslipStatus.toUpperCase()}
                          </Badge>
                          {row.errorMessage && (
                            <span
                              className="text-xs text-destructive max-w-[150px] truncate"
                              title={row.errorMessage}
                            >
                              {row.errorMessage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* When PDF exists: show View and Download actions */}
                          {row.payslipUrl && (
                            <>
                              <a
                                href={row.payslipUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm hover:bg-accent hover:text-accent-foreground text-primary"
                                title="View Payslip"
                              >
                                <FileCheck className="h-4 w-4" />
                              </a>
                              <a
                                href={row.payslipUrl}
                                download={`Payslip_${row.employeeNumber}_${year}_${month}.pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm hover:bg-accent hover:text-accent-foreground text-primary"
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </>
                          )}

                          {/* When PDF failed: show Retry PDF action */}
                          {(row.payslipStatus === "failed" && !row.payslipUrl) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRetryPdf(row.payrollItemId || row.employeeId)
                              }
                              title="Retry PDF"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          )}

                          {/* When email not yet successful: show Send Email or Retry Email */}
                          {row.payslipUrl && row.payslipStatus !== "emailed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRetryEmail(row.payrollItemId || row.employeeId)
                              }
                              title={
                                row.payslipStatus === "failed"
                                  ? "Retry Email"
                                  : "Send Email"
                              }
                            >
                              <Mail
                                className={`h-4 w-4 ${
                                  row.payslipStatus === "failed"
                                    ? "text-destructive"
                                    : ""
                                }`}
                              />
                            </Button>
                          )}
                        </div>
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
