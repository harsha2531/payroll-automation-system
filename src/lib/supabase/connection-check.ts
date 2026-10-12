import "server-only";
import { parseClientEnv } from "@/lib/env/schema";
import { createClient } from "./server";

export interface SupabaseConfigStatus {
  configured: boolean;
  hasPublishableKey: boolean;
  hasServiceRoleKey: boolean;
  projectHost?: string;
  error?: string;
}

export interface SupabaseConnectionStatus {
  configured: boolean;
  connected: boolean;
  projectHost?: string;
  hasServiceRoleKey: boolean;
  status: "connected" | "misconfigured" | "error";
  message: string;
  error?: string;
}

/**
 * Checks whether Supabase environment variables are properly configured.
 * Strictly guarantees that no secret keys, tokens, or credentials are exposed in the output.
 *
 * @param env Optional environment map, defaults to process.env
 */
export function checkSupabaseConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseConfigStatus {
  const clientCheck = parseClientEnv(env);
  const rawServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const hasServiceRoleKey = Boolean(
    rawServiceKey &&
    rawServiceKey.trim().length > 0 &&
    rawServiceKey !== "your-supabase-service-role-key"
  );

  if (!clientCheck.success || !clientCheck.data) {
    return {
      configured: false,
      hasPublishableKey: false,
      hasServiceRoleKey,
      error: "Supabase client environment configuration is missing or invalid.",
    };
  }

  try {
    const parsedUrl = new URL(clientCheck.data.NEXT_PUBLIC_SUPABASE_URL);
    return {
      configured: true,
      hasPublishableKey: true,
      hasServiceRoleKey,
      projectHost: parsedUrl.host,
    };
  } catch {
    return {
      configured: false,
      hasPublishableKey: true,
      hasServiceRoleKey,
      error: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL format.",
    };
  }
}

export interface SupabaseAuthCheckClient {
  auth: {
    getSession: () => Promise<{ error?: { message: string } | null }>;
  };
}

/**
 * Performs a safe, non-leaking server-side connection and configuration check.
 * Catches all errors safely and sanitizes output so no secret keys or tokens are exposed.
 *
 * @param clientFactory Optional async factory function returning a Supabase client (for test injection)
 */
export async function checkSupabaseConnection(
  clientFactory: () => Promise<SupabaseAuthCheckClient> = createClient
): Promise<SupabaseConnectionStatus> {
  const config = checkSupabaseConfig();

  if (!config.configured) {
    return {
      configured: false,
      connected: false,
      hasServiceRoleKey: config.hasServiceRoleKey,
      status: "misconfigured",
      message: "Supabase configuration is missing or invalid.",
      error: config.error,
    };
  }

  try {
    const supabase = await clientFactory();
    // Test auth service availability
    const { error } = await supabase.auth.getSession();

    if (error) {
      return {
        configured: true,
        connected: false,
        projectHost: config.projectHost,
        hasServiceRoleKey: config.hasServiceRoleKey,
        status: "error",
        message: "Failed to connect to Supabase Auth service.",
        error: sanitizeErrorMessage(error.message),
      };
    }

    return {
      configured: true,
      connected: true,
      projectHost: config.projectHost,
      hasServiceRoleKey: config.hasServiceRoleKey,
      status: "connected",
      message: "Supabase connection verified successfully.",
    };
  } catch (err) {
    const rawMessage =
      err instanceof Error ? err.message : "Unknown Supabase connection error";

    return {
      configured: true,
      connected: false,
      projectHost: config.projectHost,
      hasServiceRoleKey: config.hasServiceRoleKey,
      status: "error",
      message: "Supabase connection check encountered an error.",
      error: sanitizeErrorMessage(rawMessage),
    };
  }
}

/**
 * Strips JWT tokens, publishable keys, service-role keys, or API tokens from error strings.
 */
export function sanitizeErrorMessage(msg: string): string {
  let sanitized = msg;
  // Redact JWT patterns (three dot-separated base64-like strings)
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[REDACTED_JWT]"
  );
  // Redact Supabase publishable keys
  sanitized = sanitized.replace(
    /sb_publishable_[A-Za-z0-9_-]+/g,
    "[REDACTED_KEY]"
  );
  // Redact Brevo or generic api keys
  sanitized = sanitized.replace(
    /xkeysib-[A-Za-z0-9_-]+/g,
    "[REDACTED_KEY]"
  );
  return sanitized;
}
