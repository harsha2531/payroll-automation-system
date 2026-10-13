import { formatDisplayName } from "@/lib/display-name";
import type { User } from "@supabase/supabase-js";
import type { UserRole, ProfileRecord } from "@/types/auth";
import { isValidRole, EMPLOYEE_ROLE } from "./roles";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastSignInAt?: string;
}

/**
 * Maps a Supabase Auth User object and optional trusted database profile
 * to a clean application UserProfile.
 *
 * Security:
 * - Role is strictly resolved from trusted sources (database profile or app_metadata).
 * - User-supplied `user_metadata.role` is NEVER trusted or checked.
 * - Defaults safely to "employee".
 */
export function mapUserProfile(
  user: User,
  dbProfile?: Partial<ProfileRecord> | null
): UserProfile {
  const metadata = user.user_metadata ?? {};

  // Extract displayName: prefer database full_name, then metadata full_name/name/first+last, then email fallback
  let displayName = "";
  if (dbProfile?.fullName && typeof dbProfile.fullName === "string") {
    displayName = dbProfile.fullName.trim();
  } else if (metadata.full_name && typeof metadata.full_name === "string") {
    displayName = metadata.full_name.trim();
  } else if (metadata.name && typeof metadata.name === "string") {
    displayName = metadata.name.trim();
  } else if (metadata.first_name || metadata.last_name) {
    displayName = formatDisplayName(
      metadata.first_name as string | undefined,
      metadata.last_name as string | undefined
    );
  }

  if (!displayName && user.email) {
    const emailPrefix = user.email.split("@")[0];
    displayName = emailPrefix
      ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
      : "User";
  }

  // Security: strictly validate and resolve role from server-controlled sources
  let role: UserRole = EMPLOYEE_ROLE;
  if (dbProfile?.role && isValidRole(dbProfile.role)) {
    role = dbProfile.role;
  } else if (user.app_metadata?.role && isValidRole(user.app_metadata.role)) {
    role = user.app_metadata.role;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: displayName || "User",
    role,
    avatarUrl: dbProfile?.avatarUrl || (metadata.avatar_url as string) || undefined,
    createdAt: dbProfile?.createdAt || user.created_at,
    lastSignInAt: user.last_sign_in_at || undefined,
  };
}
