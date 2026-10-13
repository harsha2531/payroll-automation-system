import type { UserRole } from "@/types/auth";
import { USER_ROLES } from "@/types/auth";

export const ADMIN_ROLE: UserRole = USER_ROLES.ADMIN;
export const EMPLOYEE_ROLE: UserRole = USER_ROLES.EMPLOYEE;

/**
 * Checks if a given role string matches the admin role.
 */
export function isAdmin(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

/**
 * Validates whether a value is a valid application UserRole.
 */
export function isValidRole(role: unknown): role is UserRole {
  return role === ADMIN_ROLE || role === EMPLOYEE_ROLE;
}

/**
 * Asserts that the role is admin; throws an AuthorizationError if not.
 */
export function assertAdmin(role: string | null | undefined): void {
  if (!isAdmin(role)) {
    throw new Error("Forbidden: Administrator privileges required.");
  }
}
