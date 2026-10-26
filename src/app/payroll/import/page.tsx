import Link from "next/link";
import { AuthService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ExcelImportWizard } from "@/features/payroll/components/excel-import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportExcelPage() {
  await AuthService.requireAdmin();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 pb-10">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Import Excel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a monthly payslip workbook, review extracted amounts, then
            confirm the import.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/protected">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <ExcelImportWizard />
    </div>
  );
}
