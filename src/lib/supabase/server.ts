import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientEnv } from "@/lib/env/client";
import { getServerEnv } from "@/lib/env/server";

export {
  checkSupabaseConfig,
  checkSupabaseConnection,
  type SupabaseConfigStatus,
  type SupabaseConnectionStatus,
} from "./connection-check";

/**
 * Creates a server Supabase client for Server Components, Server Actions,
 * and Route Handlers with cookie-based session persistence.
 *
 * Uses the Next.js cookies API to read and write auth session tokens.
 * Always create a new client within each request/function when using it.
 */
export async function createClient(
  cookieStorePromise?: ReturnType<typeof cookies> | Awaited<ReturnType<typeof cookies>>
) {
  const cookieStore = cookieStorePromise
    ? await cookieStorePromise
    : await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getClientEnv();

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy/middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Named alias for createClient when importing alongside client-side factories.
 */
export const createServerSupabaseClient = createClient;

/**
 * Creates an elevated Supabase admin/service-role client.
 * Strictly server-only. Bypasses Row Level Security (RLS).
 * Never use for untrusted operations or expose to the browser.
 */
export function createAdminClient() {
  const env = getServerEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op for service role client
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Alias for createAdminClient.
 */
export const createServiceRoleClient = createAdminClient;

