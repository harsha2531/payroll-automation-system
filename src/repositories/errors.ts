import "server-only";

import { sanitizeErrorMessage } from "@/lib/supabase/connection-check";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Maps database errors (PostgREST / PostgreSQL) to safe, user-friendly error messages.
 * Prevents leaking table schemas, JWT tokens, connection strings, or internal details.
 */
export function mapDatabaseError(
  error: unknown,
  fallbackMessage = "A database operation error occurred."
): string {
  if (!error) return fallbackMessage;

  const pgError = error as PostgrestErrorLike;
  const code = pgError.code;

  if (code === "23505") {
    return "A record with these unique details already exists.";
  }

  if (code === "23503") {
    return "Referenced record does not exist, or this item cannot be deleted because dependent records exist.";
  }

  if (code === "23514") {
    return "The provided data violates record validation rules or constraints.";
  }

  if (code === "42501" || code === "PGRST301") {
    return "Permission denied: You are not authorized to perform this operation.";
  }

  if (code === "PGRST116") {
    return "The requested record was not found.";
  }

  // Sanitize any message to ensure no JWTs, tokens, or keys are exposed
  const rawMsg = pgError.message || (error instanceof Error ? error.message : fallbackMessage);
  return sanitizeErrorMessage(rawMsg);
}
