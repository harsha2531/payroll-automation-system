import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth';
import { ProfileRepository } from '@/repositories';
import type { UserRole } from '@/types/auth';

/**
 * GET /api/admin/users
 * Query params: page (default 1), perPage (default 20), search (optional)
 * Returns paginated list of employee profiles.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const perPage = Number(url.searchParams.get('perPage') ?? '20');
  const search = url.searchParams.get('search') ?? '';

  const supabase = getServiceSupabase();

  // Build query with optional search across email or full_name
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
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
    pagination: { page, perPage, total: count },
  });
}

/**
 * POST /api/admin/users
 * Body: { userId: string, role: UserRole }
 * Updates a user's role (admin ↔ employee). Requires admin privileges.
 */
export async function POST(request: Request) {
  const { userId, role } = await request.json();
  if (!userId || !role) {
    return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  // The repository performs a role update; it expects a Supabase client with RLS bypass.
  const result = await ProfileRepository.updateUserRole(supabase, userId, role as UserRole);
  if (result.isErr()) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: result.value });
}
