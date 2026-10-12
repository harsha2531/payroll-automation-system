import { z } from "zod";

/**
 * Forbidden secret keywords that must NEVER be prefixed with NEXT_PUBLIC_
 */
export const FORBIDDEN_PUBLIC_KEYWORDS = [
  "SECRET",
  "PRIVATE",
  "SERVICE_ROLE",
  "API_KEY",
  "PASSWORD",
  "TOKEN",
  "CREDENTIAL",
] as const;

/**
 * Browser-safe environment variable schema.
 * All variables here MUST be prefixed with NEXT_PUBLIC_.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot be empty"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .optional()
    .default("http://localhost:3000"),
});

/**
 * Server-only environment variable schema.
 * Variables here must NEVER have the NEXT_PUBLIC_ prefix.
 */
export const serverEnvSchema = z
  .object({
    // Supabase Server Credentials
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, "SUPABASE_SERVICE_ROLE_KEY cannot be empty"),

    // Brevo Email Integration Credentials
    BREVO_API_KEY: z
      .string()
      .min(1, "BREVO_API_KEY cannot be empty"),
    BREVO_SENDER_EMAIL: z
      .string()
      .email("BREVO_SENDER_EMAIL must be a valid email address"),
    BREVO_SENDER_NAME: z
      .string()
      .min(1, "BREVO_SENDER_NAME cannot be empty"),

    // Application Environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  })
  // Merge client schema into server schema so server has access to all env vars
  .merge(clientEnvSchema);

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Formats validation issues without leaking any received secret values in errors or logs.
 */
export function formatEnvIssues(issues: z.ZodIssue[]): string {
  const formatted = issues.map((issue) => {
    const key = issue.path.join(".") || "UNKNOWN_VARIABLE";
    const isMissing =
      (issue.code === "invalid_type" &&
        "received" in issue &&
        (issue as { received?: string }).received === "undefined") ||
      issue.message.includes("received undefined");
    const message = isMissing ? `${key} is required` : issue.message;
    return `[${key}]: ${message}`;
  });

  return `Environment configuration validation failed:\n  ${formatted.join("\n  ")}`;
}

/**
 * Validates that no secret keys are accidentally exposed with NEXT_PUBLIC_ prefix.
 */
export function validateNoPublicSecrets(env: Record<string, string | undefined>): void {
  const exposedSecrets = Object.keys(env).filter((key) => {
    if (!key.startsWith("NEXT_PUBLIC_")) return false;
    const keyUpper = key.toUpperCase();
    return FORBIDDEN_PUBLIC_KEYWORDS.some((keyword) => keyUpper.includes(keyword));
  });

  // Filter out known safe public keys like NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const actualLeaks = exposedSecrets.filter(
    (key) => key !== "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );

  if (actualLeaks.length > 0) {
    throw new Error(
      `Security violation: Secret variables must not be exposed with NEXT_PUBLIC_ prefix: ${actualLeaks.join(", ")}`
    );
  }
}

/**
 * Pure validation for browser-safe environment variables.
 */
export function parseClientEnv(env: Record<string, string | undefined>): {
  success: boolean;
  data?: ClientEnv;
  error?: string;
} {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    return {
      success: false,
      error: formatEnvIssues(result.error.issues),
    };
  }
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Pure validation for server-only environment variables.
 */
export function parseServerEnv(env: Record<string, string | undefined>): {
  success: boolean;
  data?: ServerEnv;
  error?: string;
} {
  // First verify no sensitive keys are exposed as NEXT_PUBLIC_
  validateNoPublicSecrets(env);

  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    return {
      success: false,
      error: formatEnvIssues(result.error.issues),
    };
  }
  return {
    success: true,
    data: result.data,
  };
}
