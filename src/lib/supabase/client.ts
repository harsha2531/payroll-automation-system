import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env/client";

/**
 * Creates a browser-safe Supabase client using validated public environment variables.
 * Safe to use in Client Components and pages.
 * Never requests or exposes server-only secrets or service-role keys.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getClientEnv();

  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Explicit alias for createClient for readability in mixed contexts.
 */
export const createBrowserSupabaseClient = createClient;

