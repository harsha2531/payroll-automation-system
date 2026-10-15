import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { ProfileRepository } from "@/repositories";
import type { UserRole } from "@/types/auth";

/**
 * GET /api/admin/users
 * Query params: page (default 1), perPage (default 20), search (optional)
 * Returns paginated list of employee profiles.
 * Requires admin privileges.
 */
export async function GET(request: Request) {
  const { profile } = await AuthService.getCurrentUserWithProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Administrator privileges required" },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("perPage") ?? "20");
  const search = url.searchParams.get("search") ?? "";

  const supabase = getServiceSupabase();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, role, avatar_url, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data,
    pagination: { page, perPage, total: count ?? 0 },
  });
}

/**
 * POST /api/admin/users
 * Body: { userId: string, role: UserRole }
 * Updates a user's role (admin <-> employee). Requires admin privileges.
 */
export async function POST(request: Request) {
  const { profile } = await AuthService.getCurrentUserWithProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Administrator privileges required" },
      { status: 403 }
    );
  }

  let body: { userId?: string; role?: UserRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role) {
    return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
  }

  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const result = await ProfileRepository.updateUserRole(supabase, userId, role);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Also sync app_metadata so Supabase Auth claims reflect the change immediately
  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  return NextResponse.json({ success: true, user: result.data });
}
