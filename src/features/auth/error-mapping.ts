/**
 * Maps Supabase authentication errors to user-friendly messages.
 * Prevents account enumeration and internal credential leakage.
 */
export function mapAuthError(error: unknown): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (error as { message?: string }).message ?? "";

  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials") ||
    lower.includes("invalid_grant") ||
    lower.includes("invalid email or password")
  ) {
    return "Invalid email or password. Please verify your credentials.";
  }

  if (
    lower.includes("user already registered") ||
    lower.includes("email_exists") ||
    lower.includes("user_already_exists")
  ) {
    return "An account with this email address already exists.";
  }

  if (lower.includes("password should be at least") || lower.includes("weak_password")) {
    return "Password is too short. It must be at least 6 characters long.";
  }

  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }

  if (
    lower.includes("token has expired") ||
    lower.includes("token is expired") ||
    lower.includes("otp_expired") ||
    lower.includes("token expired")
  ) {
    return "The verification link has expired. Please request a new one.";
  }

  if (
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "Too many attempts. Please wait a few moments and try again.";
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch")
  ) {
    return "Network error. Please check your internet connection.";
  }

  // Fallback to safe generic message to prevent leaking internal database or backend details
  return "An unexpected error occurred. Please try again.";
}
