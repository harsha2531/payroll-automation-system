/**
 * Application Authorization & Role Types.
 * Phase 2.3: Authorization, Security & Quality Gate
 */

export type UserRole = "admin" | "employee";

export const USER_ROLES = {
  ADMIN: "admin" as UserRole,
  EMPLOYEE: "employee" as UserRole,
} as const;

/**
 * Trusted database record structure for public.profiles.
 */
export interface ProfileRecord {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Editable user profile input fields (excluding role).
 */
export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string;
}
