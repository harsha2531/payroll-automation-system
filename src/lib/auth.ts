import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ProfileRepository } from "@/repositories/profile.repository";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Service role Supabase client for administrative/backend operations.
 * Strictly server-only; bypasses Row Level Security.
 */
export function getServiceSupabase(): SupabaseClient {
  return createAdminClient();
}

export const supabaseClient = {
  get client(): SupabaseClient {
    return createAdminClient();
  },
};

/**
 * Retrieve the currently authenticated user from cookie session.
 * Returns the user object if a valid session exists, otherwise null.
 */
export async function auth(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Ensures the supplied user or current session has the "admin" role.
 * Throws a 403-style error if the user is not an admin.
 */
export async function requireAdmin(client?: SupabaseClient, targetUserId?: string): Promise<void> {
  const supabase = client ?? (await createClient());
  let userId = targetUserId;

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const err = new Error("Unauthorized: Sign in required");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    userId = user.id;
  }

  const profile = await ProfileRepository.getProfileById(supabase, userId);
  if (!profile || profile.role !== "admin") {
    const err = new Error("Forbidden: Administrator privileges required");
    (err as unknown as { status: number }).status = 403;
    throw err;
  }
}
