import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env/server';

/**
 * POST /api/bootstrap/admin
 * Body: { userId: string }
 * Header: x-bootstrap-secret (matches BOOTSTRAP_ADMIN_SECRET)
 * Creates the first admin if none exists.
 */
export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-bootstrap-secret');
  const { BOOTSTRAP_ADMIN_SECRET } = getServerEnv();
  if (!secretHeader || secretHeader !== BOOTSTRAP_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Invalid bootstrap secret' }, { status: 401 });
  }

  let payload: { userId: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId } = payload;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('bootstrap_first_admin', { target_user_id: userId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
