import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployeeService } from "@/services/employee.service";
import { EmployeeStatusToggle } from "@/features/employees/components/employee-status-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatMoney(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: EmployeeDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const employee = await EmployeeService.getById(supabase as never, id);

  if (!employee) {
    notFound();
  }

  const created = query?.created === "1";
  const updated = query?.updated === "1";
  const details = employee.payrollDetails;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/employees" className="hover:underline">
              Employees
            </Link>
            {" / "}
            {employee.fullName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {employee.fullName}
            </h1>
            <Badge className="capitalize">
              {employee.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.employeeNumber}
            {employee.designation ? ` · ${employee.designation}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EmployeeStatusToggle
            employeeId={employee.id}
            status={employee.status}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/employees/edit/${employee.id}`}>Edit</Link>
          </Button>
        </div>
      </div>

      {(created || updated) && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {created
            ? "Employee created successfully."
            : "Employee updated successfully."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity & contact</CardTitle>
            <CardDescription>Master employee record</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Employee number" value={employee.employeeNumber} />
              <Detail label="EPF number" value={employee.epfNumber ?? "—"} />
              <Detail label="Email" value={employee.email} />
              <Detail label="Phone" value={employee.phone ?? "—"} />
              <Detail label="Designation" value={employee.designation ?? "—"} />
              <Detail label="Department" value={employee.department ?? "—"} />
              <Detail label="Hire date" value={employee.hireDate ?? "—"} />
              <Detail
                label="Termination date"
                value={employee.terminationDate ?? "—"}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current payroll details</CardTitle>
            <CardDescription>
              Editable defaults — independent of monthly payroll snapshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            {details ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail
                  label="Basic salary"
                  value={formatMoney(details.basicSalary)}
                />
                <Detail
                  label="Allowances"
                  value={formatMoney(details.allowances)}
                />
                <Detail
                  label="Variable pay"
                  value={
                    details.variablePayLabel
                      ? `${details.variablePayLabel}: ${formatMoney(details.variablePayAmount)}`
                      : formatMoney(details.variablePayAmount)
                  }
                />
                <Detail
                  label="Effective from"
                  value={details.effectiveFrom ?? "—"}
                />
                <div className="sm:col-span-2">
                  <Detail label="Notes" value={details.notes ?? "—"} />
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No current payroll defaults set.{" "}
                <Link
                  href={`/employees/edit/${employee.id}`}
                  className="underline underline-offset-4"
                >
                  Add them
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
