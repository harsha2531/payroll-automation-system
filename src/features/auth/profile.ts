import { formatDisplayName } from "@/lib/display-name";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  lastSignInAt?: string;
}

/**
 * Maps a Supabase Auth User object to a clean application UserProfile.
 * Extracts displayName from user_metadata (full_name, name, or first+last name),
 * falling back gracefully to email username.
 */
export function mapUserProfile(user: User): UserProfile {
  const metadata = user.user_metadata ?? {};

  let displayName = "";
  if (metadata.full_name && typeof metadata.full_name === "string") {
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

  const role =
    (user.app_metadata?.role as string) ||
    (metadata.role as string) ||
    "employee";

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: displayName || "User",
    role,
    avatarUrl: (metadata.avatar_url as string) || undefined,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || undefined,
  };
}
