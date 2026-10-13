import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRecord, UpdateProfileInput, UserRole } from "@/types/auth";
import { Result } from "@/types/common";

interface DatabaseProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToProfileRecord(row: DatabaseProfileRow): ProfileRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role === "admin" ? "admin" : "employee",
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Repository layer for public.profiles database table.
 * Encapsulates all database operations and ensures server-only execution.
 */
export const ProfileRepository = {
  /**
   * Fetches a user profile by user ID.
   * Subject to Row Level Security: regular users can only read their own profile,
   * while admins can read any profile.
   */
  async getProfileById(
    supabase: SupabaseClient,
    userId: string
  ): Promise<ProfileRecord | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, avatar_url, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapRowToProfileRecord(data as DatabaseProfileRow);
    } catch {
      return null;
    }
  },

  /**
   * Updates non-privileged user profile fields (fullName, avatarUrl).
   * Security: This function explicitly omits and ignores role modifications.
   */
  async updateProfile(
    supabase: SupabaseClient,
    userId: string,
    input: UpdateProfileInput
  ): Promise<Result<ProfileRecord>> {
    try {
      const updateData: {
        full_name?: string;
        avatar_url?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (input.fullName !== undefined) {
        updateData.full_name = input.fullName;
      }
      if (input.avatarUrl !== undefined) {
        updateData.avatar_url = input.avatarUrl;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
        .select()
        .single();

      if (error || !data) {
        return Result.err(error?.message || "Failed to update profile.");
      }

      return Result.ok(mapRowToProfileRecord(data as DatabaseProfileRow));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      return Result.err(message);
    }
  },

  /**
   * Updates a user's role.
   * This is an administrative operation that must only be executed by an admin client.
   */
  async updateUserRole(
    adminSupabase: SupabaseClient,
    targetUserId: string,
    newRole: UserRole
  ): Promise<Result<ProfileRecord>> {
    try {
      const { data, error } = await adminSupabase
        .from("profiles")
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single();

      if (error || !data) {
        return Result.err(error?.message || "Failed to update user role.");
      }

      return Result.ok(mapRowToProfileRecord(data as DatabaseProfileRow));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user role.";
      return Result.err(message);
    }
  },
};
