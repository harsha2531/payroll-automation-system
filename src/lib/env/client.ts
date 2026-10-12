import { clientEnvSchema, formatEnvIssues, type ClientEnv } from "./schema";

let cachedClientEnv: ClientEnv | null = null;

/**
 * Resets the cached client environment variables (primarily for testing).
 */
export function resetClientEnvCache(): void {
  cachedClientEnv = null;
}

/**
 * Access browser-safe environment variables.
 * Safe to import in both Client and Server Components.
 */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const rawEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  const parsed = clientEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const message = formatEnvIssues(parsed.error.issues);
    throw new Error(message);
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}
