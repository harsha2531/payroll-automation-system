import Link from "next/link";
import { AuthService } from "@/services/auth.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  ArrowLeft,
  Upload,
  CheckCircle2,
  FileCheck2,
  Cpu,
} from "lucide-react";

export default async function ImportExcelPage() {
  await AuthService.requireAdmin();

  return (
    <div className="flex-1 w-full flex flex-col gap-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Import Excel
            </h1>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Planned Feature
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Bulk upload attendance, overtime, and salary breakdown workbooks (.xlsx, .xls)
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
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">Excel Payroll Importer</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            This module will allow administrators to upload monthly Excel attendance sheets, map columns automatically, and preview payroll calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Planned workflow steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Upload className="h-4 w-4" />
                <span>1. Upload Workbook</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Drag-and-drop or browse standard .xlsx workbooks with employee attendance and earnings.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Cpu className="h-4 w-4" />
                <span>2. Column Mapping</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Intelligent schema detection matches basic salary, allowances, deductions, and overtime.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <FileCheck2 className="h-4 w-4" />
                <span>3. Pre-flight Validation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Comprehensive error checks verify formulas, duplicate employee IDs, and statutory limits.
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
