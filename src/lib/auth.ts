// src/lib/auth.ts
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Create a Supabase client for server‑side usage (service role).
 */
export const supabaseClient: SupabaseClient = createServerSupabaseClient();

/**
 * Backward‑compatible helper that returns the same service client.
 */
export function getServiceSupabase(): SupabaseClient {
  return supabaseClient;
}

/**
 * Retrieve the currently authenticated user.
 * Returns the user object if a valid session exists, otherwise null.
 */
export async function auth(): Promise<User | null> {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error("Auth error:", error);
    return null;
  }
  return user;
}

/**
 * Ensures the supplied user has the "admin" role.
 * Throws a 403‑style error if the user is not an admin.
 */
export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  // Assuming you have a ProfileRepository elsewhere to fetch role; replace as needed.
  // For now, we simply check a custom claim or role stored in user metadata.
  const role = (user?.app_metadata?.role as string) ?? null;
  if (role !== "admin") {
    const err: any = new Error("Forbidden: Administrator privileges required");
    err.status = 403;
    throw err;
  }
}

