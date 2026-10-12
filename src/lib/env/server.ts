import "server-only";
import {
  serverEnvSchema,
  formatEnvIssues,
  validateNoPublicSecrets,
  type ServerEnv,
} from "./schema";

let cachedServerEnv: ServerEnv | null = null;

/**
 * Access validated server-only environment variables.
 *
 * Rules:
 * - NEVER import this file into Client Components (enforced by "server-only").
 * - Validates required server keys (e.g. Supabase Service Role Key, Brevo API Key).
 * - Fails clearly without leaking secret values in error messages.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  // Verify no sensitive keys are prefixed with NEXT_PUBLIC_
  validateNoPublicSecrets(process.env);

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = formatEnvIssues(parsed.error.issues);
    throw new Error(message);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}
