import { EmployeeRepository } from '@/repositories';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage({ searchParams }: { searchParams: Record<string, string | string[]> }) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  const page = Number(searchParams.page) || 1;
  const pageSize = Number(searchParams.pageSize) || 20;
  const status = (searchParams.status as string) ?? undefined;
  const search = (searchParams.search as string) ?? undefined;

  const result = await EmployeeRepository.listEmployees(
    auth.supabaseClient,
    { page, pageSize, status: status as any, search }
  );

  if (result.isErr) {
    return <div className="p-4 text-red-600">Failed to load employees.</div>;
  }

  const { items, totalPages } = result.value;

  return (
    <section className="p-4">
      <h1 className="text-2xl font-bold mb-4">Employees</h1>
      <div className="flex items-center mb-4">
        <form className="flex gap-2" method="GET">
          <input
            type="text"
            name="search"
            placeholder="Search…"
            defaultValue={search ?? ''}
            className="border rounded px-2 py-1"
          />
          <button type="submit" className="bg-blue-600 text-white rounded px-3 py-1">
            Search
          </button>
        </form>
        <a href="/employees/add" className="ml-auto bg-green-600 text-white rounded px-3 py-1">
          Add Employee
        </a>
      </div>
      {items.length === 0 ? (
        <p>No employees found.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Number</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Designation</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((emp) => (
              <tr key={emp.id} className={emp.status === 'inactive' ? 'opacity-50' : ''}>
                <td className="border p-2">{emp.employeeNumber}</td>
                <td className="border p-2">{emp.fullName}</td>
                <td className="border p-2">{emp.email}</td>
                <td className="border p-2">{emp.designation ?? ''}</td>
                <td className="border p-2 capitalize">{emp.status}</td>
                <td className="border p-2">
                  <a href={`/employees/edit/${emp.id}`} className="text-blue-600 underline">
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <a
            key={p}
            href={`?page=${p}&pageSize=${pageSize}${search ? `&search=${search}` : ''}${status ? `&status=${status}` : ''}`}
            className={`px-3 py-1 border rounded ${p === page ? 'bg-blue-600 text-white' : ''}`}
          >
            {p}
          </a>
        ))}
      </div>
    </section>
  );
}
