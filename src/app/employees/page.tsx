import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { EmployeeRepository } from "@/repositories";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth.service";
import type { Employee, EmployeeStatus } from "@/types/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface EmployeesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function statusVariant(
  status: EmployeeStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "terminated":
      return "destructive";
    default:
      return "outline";
  }
}

function buildQuery(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const q = new URLSearchParams();
  if (params.page && params.page > 1) q.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) {
    q.set("pageSize", String(params.pageSize));
  }
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const { user } = await AuthService.getCurrentUserWithProfile();
  if (!user) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const pageSize = Number(params?.pageSize) || 20;
  const statusParam = typeof params?.status === "string" ? params.status : undefined;
  const status = statusParam as EmployeeStatus | undefined;
  const search = typeof params?.search === "string" ? params.search : undefined;
  const created = params?.created === "1";
  const updated = params?.updated === "1";

  const supabase = await createClient();
  const result = await EmployeeRepository.listEmployees(supabase as never, {
    page,
    pageSize,
    status,
    search,
  });

  if (!result.success) {
    return (
      <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load employees: {result.error}
      </div>
    );
  }

  const { items, total, totalPages } = result.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee identity and current payroll defaults.
          </p>
        </div>
        <Button asChild>
          <Link href="/employees/add">
            <Plus className="h-4 w-4" />
            Add employee
          </Link>
        </Button>
      </div>

      {(created || updated) && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {created ? "Employee created successfully." : "Employee updated successfully."}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>
            {total} employee{total === 1 ? "" : "s"}
            {status ? ` · filtered by ${status.replace("_", " ")}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                name="search"
                placeholder="Search name, number, email, or EPF…"
                defaultValue={search ?? ""}
                className="pl-8"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
            </select>
            {pageSize !== 20 && (
              <input type="hidden" name="pageSize" value={pageSize} />
            )}
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No employees found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2 font-medium">Number</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Designation</th>
                    <th className="px-3 py-2 font-medium">EPF</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((emp: Employee) => (
                    <tr
                      key={emp.id}
                      className={
                        emp.status === "inactive" || emp.status === "terminated"
                          ? "border-b opacity-60"
                          : "border-b"
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {emp.employeeNumber}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {emp.fullName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{emp.email}</td>
                      <td className="px-3 py-2">{emp.designation ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {emp.epfNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(emp.status)} className="capitalize">
                          {emp.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            href={`/employees/edit/${emp.id}`}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildQuery({ page: p, pageSize, search, status })}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
