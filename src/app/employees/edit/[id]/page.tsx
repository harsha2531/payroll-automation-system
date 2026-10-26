import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployeeService } from "@/services/employee.service";
import { EmployeeForm } from "@/features/employees/components/employee-form";

export const dynamic = "force-dynamic";

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const employee = await EmployeeService.getById(supabase as never, id);

  if (!employee) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/employees" className="hover:underline">
            Employees
          </Link>
          {" / "}
          <Link href={`/employees/${employee.id}`} className="hover:underline">
            {employee.fullName}
          </Link>
          {" / "}
          Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Edit employee
        </h1>
        <p className="text-sm text-muted-foreground">
          Update identity details and current compensation defaults. Monthly
          payroll history is not changed.
        </p>
      </div>
      <EmployeeForm mode="edit" employee={employee} />
    </section>
  );
}
