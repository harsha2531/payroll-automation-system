import Link from "next/link";
import { AuthService } from "@/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Users,
  CalendarDays,
  FileText,
  Mail,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Building2,
  Lock,
  User as UserIcon,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "approved":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "processing":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "calculated":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "failed":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default async function ProtectedDashboardPage() {
  // Server-side authorization check: strictly enforces admin role
  const { profile } = await AuthService.requireAdmin();

  // Query live database records for dashboard metrics
  const supabase = await createClient();

  // 1. Total employees & active employees
  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true });

  const { count: activeEmployees } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // 2. Selected / latest payroll cycle run
  const { data: latestRun } = await supabase
    .from("payroll_runs")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Payslips generated count
  const { count: payslipsGeneratedCount } = await supabase
    .from("payslip_documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "generated");

  // 4. Emails sent count
  const { count: emailsSentCount } = await supabase
    .from("email_deliveries")
    .select("*", { count: "exact", head: true })
    .in("delivery_status", ["sent", "delivered"]);

  // 5. Recent payroll activity logs
  const { data: recentRuns } = await supabase
    .from("payroll_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const selectedMonthName =
    latestRun && latestRun.month >= 1 && latestRun.month <= 12
      ? MONTH_NAMES[latestRun.month - 1]
      : null;

  return (
    <div className="flex-1 w-full flex flex-col gap-8 pb-10">
      {/* Dashboard Top Header & Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Payroll Dashboard
            </h1>
            <Badge variant="default" className="capitalize bg-emerald-600 hover:bg-emerald-700 text-white">
              <Lock className="h-3 w-3 mr-1" />
              {profile.role}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back, <strong className="text-foreground font-medium">{profile.displayName}</strong>. Here is your enterprise payroll operations summary.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">
              <Users className="h-4 w-4 mr-1.5" />
              Employees
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/payroll/import">
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Import Excel
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Card 1: Total Employees */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {totalEmployees !== null && totalEmployees > 0 ? (
              <>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {totalEmployees}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeEmployees ?? 0} active in organization
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-muted-foreground">0</div>
                <p className="text-xs text-muted-foreground">No employees registered yet</p>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Employee Directory</span>
              <Link
                href="/employees"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Selected Payroll Month */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Selected Payroll Month
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CalendarDays className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {latestRun ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                    {selectedMonthName} {latestRun.year}
                  </div>
                  <Badge variant="outline" className={`capitalize text-[10px] px-1.5 py-0 ${getStatusBadgeClass(latestRun.status)}`}>
                    {latestRun.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Run #{latestRun.sequence_number} &bull; {latestRun.run_type}
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-lg font-semibold text-muted-foreground">No Run Selected</div>
                <p className="text-xs text-muted-foreground">No payroll month processed yet</p>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Monthly Processing</span>
              <Link
                href="/payroll/monthly"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Payslips Generated */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Payslips Generated
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {payslipsGeneratedCount !== null && payslipsGeneratedCount > 0 ? (
              <>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {payslipsGeneratedCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF documents ready for distribution
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-muted-foreground">0</div>
                <p className="text-xs text-muted-foreground">No payslips generated yet</p>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Payslip Archive</span>
              <Link
                href="/payslips"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                View <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Emails Sent */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Emails Sent
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {emailsSentCount !== null && emailsSentCount > 0 ? (
              <>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {emailsSentCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Dispatched via Brevo delivery service
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-muted-foreground">0</div>
                <p className="text-xs text-muted-foreground">No payslip emails sent yet</p>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Email Deliveries</span>
              <Link
                href="/payslips"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                Status <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payroll Activity Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Recent Payroll Activity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical record of payroll runs and calculation cycles
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/payroll/monthly">View all cycles</Link>
          </Button>
        </div>

        {recentRuns && recentRuns.length > 0 ? (
          <Card className="overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs uppercase font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="px-5 py-3">Cycle Period</th>
                    <th scope="col" className="px-5 py-3">Run Type</th>
                    <th scope="col" className="px-5 py-3 text-right">Employees</th>
                    <th scope="col" className="px-5 py-3 text-right">Total Net Pay</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRuns.map((run) => {
                    const mName =
                      run.month >= 1 && run.month <= 12
                        ? MONTH_NAMES[run.month - 1]
                        : `Month ${run.month}`;
                    return (
                      <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">
                          {mName} {run.year}
                          <span className="text-xs text-muted-foreground ml-2">
                            (Run #{run.sequence_number})
                          </span>
                        </td>
                        <td className="px-5 py-3.5 capitalize text-muted-foreground">
                          {run.run_type}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          {run.total_employees}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-medium text-foreground">
                          {formatCurrency(run.total_net_pay || 0)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="outline" className={`capitalize text-xs ${getStatusBadgeClass(run.status)}`}>
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(run.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Empty State when no activity is available */
          <Card className="border-dashed border-2 border-border shadow-none bg-muted/10">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                No Recent Payroll Activity
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1 mb-5">
                No payroll calculations or run history have been recorded in the database yet. When you import an Excel attendance sheet or calculate monthly payroll, activity will be displayed here.
              </p>
              <div className="flex items-center gap-3">
                <Button asChild size="sm" variant="default">
                  <Link href="/payroll/import">
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    Import Excel Workbook
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/employees">
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add Employees
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Administrator Profile & Access Summary Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base">Administrator Profile &amp; Privilege Guard</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>RBAC Verified</span>
            </div>
          </div>
          <CardDescription>
            Session verified against trusted database profiles table with Row Level Security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="rounded-md border border-border/80 bg-muted/20 p-3">
              <span className="text-muted-foreground block mb-1">Display Name</span>
              <span className="font-semibold text-foreground text-sm">{profile.displayName}</span>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 p-3">
              <span className="text-muted-foreground block mb-1">Account Email</span>
              <span className="font-semibold text-foreground text-sm">{profile.email}</span>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 p-3">
              <span className="text-muted-foreground block mb-1">Privilege Role</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-sm">
                {profile.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
