import { EmployeeRepository } from "@/repositories";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth.service";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Employee, EmployeeStatus } from "@/types/payroll";

export const dynamic = "force-dynamic";

interface EmployeesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  const supabase = await createClient();
  const result = await EmployeeRepository.listEmployees(
    supabase as never,
    { page, pageSize, status, search }
  );

  if (!result.success) {
    return <div className="p-4 text-red-600">Failed to load employees.</div>;
  }

  const { items, totalPages } = result.data;

  return (
    <section className="p-4">
      <h1 className="text-2xl font-bold mb-4">Employees</h1>
      <div className="flex items-center mb-4">
        <form className="flex gap-2" method="GET">
          <input
            type="text"
            name="search"
            placeholder="Search…"
            defaultValue={search ?? ""}
            className="border rounded px-2 py-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-1">
            Search
          </button>
        </form>
        <Link href="/employees/add" className="ml-auto bg-green-600 text-white rounded px-3 py-1">
          Add Employee
        </Link>
      </div>
      {items.length === 0 ? (
        <p>No employees found.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2">Number</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Designation</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((emp: Employee) => (
              <tr key={emp.id} className={emp.status === "inactive" ? "opacity-50" : ""}>
                <td className="border p-2">{emp.employeeNumber}</td>
                <td className="border p-2">{emp.fullName}</td>
                <td className="border p-2">{emp.email}</td>
                <td className="border p-2">{emp.designation ?? ""}</td>
                <td className="border p-2 capitalize">{emp.status}</td>
                <td className="border p-2">
                  <Link href={`/employees/edit/${emp.id}`} className="text-blue-600 underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <Link
            key={p}
            href={`?page=${p}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`}
            className={`px-3 py-1 border rounded ${p === page ? "bg-blue-600 text-white" : ""}`}
          >
            {p}
          </Link>
        ))}
      </div>
    </section>
  );
}
