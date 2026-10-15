import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";

/**
 * POST /api/bootstrap/admin
 * Body: { userId: string }
 * Header: x-bootstrap-secret (matches BOOTSTRAP_ADMIN_SECRET)
 * Creates the first admin if none exists.
 */
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-bootstrap-secret");
  const { BOOTSTRAP_ADMIN_SECRET } = getServerEnv();

  if (!BOOTSTRAP_ADMIN_SECRET || !secretHeader || secretHeader !== BOOTSTRAP_ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid bootstrap secret" }, { status: 401 });
  }

  let payload: { userId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = payload;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Verify user exists in auth.users
  const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError || !userData?.user) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  // 2. Check if an admin already exists in auth.users or public.profiles
  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
  if (!listError && usersList?.users) {
    const existingAdmin = usersList.users.find(
      (u) => u.id !== userId && u.app_metadata?.role === "admin"
    );
    if (existingAdmin) {
      return NextResponse.json(
        { error: "An administrator account already exists. Bootstrap is disabled." },
        { status: 409 }
      );
    }
  }

  try {
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .neq("id", userId)
      .limit(1);

    if (existingProfiles && existingProfiles.length > 0) {
      return NextResponse.json(
        { error: "An administrator account already exists. Bootstrap is disabled." },
        { status: 409 }
      );
    }
  } catch {
    // If profiles table does not exist yet, continue with fallback
  }

  // 3. Try stored procedure if available
  const { error: rpcError } = await supabase.rpc("bootstrap_first_admin", {
    target_user_id: userId,
  });

  // If RPC errored with anything other than "not found", return conflict
  if (rpcError && rpcError.code !== "PGRST202") {
    return NextResponse.json({ error: rpcError.message }, { status: 409 });
  }

  // 4. Ensure app_metadata is updated so Supabase Auth claims immediately reflect admin
  const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" },
  });

  if (authUpdateError) {
    return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
  }

  // 5. Attempt upsert into public.profiles if table exists
  try {
    const user = userData.user;
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        full_name:
          (user.user_metadata?.full_name as string) ??
          (user.user_metadata?.name as string) ??
          null,
        role: "admin",
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // Ignore if table schema is pending migration
  }

  return NextResponse.json({
    success: true,
    message: "Initial administrator successfully established.",
  });
}
