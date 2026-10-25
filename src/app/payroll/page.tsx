import Link from "next/link";
import { AuthService } from "@/services/auth.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Banknote,
  ArrowLeft,
  Calendar,
  Calculator,
  ShieldAlert,
  Send,
} from "lucide-react";

export default async function MonthlyPayrollPage() {
  await AuthService.requireAdmin();

  return (
    <div className="flex-1 w-full flex flex-col gap-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Monthly Payroll
            </h1>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Planned Feature
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Initiate, calculate, review, and finalize monthly enterprise payroll cycles
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/protected">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Main Placeholder Card */}
      <Card className="border-dashed border-2 shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
            <Banknote className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">Monthly Payroll Processing Engine</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            This module will calculate statutory EPF (8% employee / 12% employer), ETF (3% employer), net pay, and manage administrative approval workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Calendar className="h-4 w-4" />
                <span>1. Cycle Selection</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Define the payroll period, cycle sequence, and select active workforce members for the run.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Calculator className="h-4 w-4" />
                <span>2. Statutory Computation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automated calculation of basic salary, allowances, statutory EPF/ETF contributions, and net pay.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Send className="h-4 w-4" />
                <span>3. Approval &amp; Release</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Two-step administrator sign-off locks records and triggers automated payslip PDF generation.
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button asChild variant="outline">
              <Link href="/protected">
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
