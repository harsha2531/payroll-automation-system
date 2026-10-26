import Link from "next/link";
import { EmployeeForm } from "@/features/employees/components/employee-form";

export const dynamic = "force-dynamic";

export default function AddEmployeePage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/employees" className="hover:underline">
            Employees
          </Link>
          {" / "}
          Add
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add employee</h1>
        <p className="text-sm text-muted-foreground">
          Create a new employee record and optional current payroll defaults.
        </p>
      </div>
      <EmployeeForm mode="create" />
    </section>
  );
}
