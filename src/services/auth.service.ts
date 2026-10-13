import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository } from "@/repositories/profile.repository";
import { mapUserProfile, type UserProfile } from "@/features/auth/profile";
import { isAdmin } from "@/features/auth/roles";

export interface AuthenticatedContext {
  user: User;
  profile: UserProfile;
  isAdmin: boolean;
}

/**
 * Server-only authorization and session verification service.
 * Enforces role-based access control and prevents unauthorized access to application resources.
 */
export const AuthService = {
  /**
   * Retrieves the current user session and their trusted profile from the database.
   */
  async getCurrentUserWithProfile(
    client?: SupabaseClient
  ): Promise<{ user: User | null; profile: UserProfile | null; isAdmin: boolean }> {
    const supabase = client ?? (await createClient());

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return { user: null, profile: null, isAdmin: false };
      }

      // Fetch trusted database profile from public.profiles
      const dbProfile = await ProfileRepository.getProfileById(supabase, user.id);
      const profile = mapUserProfile(user, dbProfile);

      return {
        user,
        profile,
        isAdmin: isAdmin(profile.role),
      };
    } catch {
      return { user: null, profile: null, isAdmin: false };
    }
  },

  /**
   * Enforces that the request is authenticated.
   * Redirects unauthenticated requests to `/auth/login`.
   */
  async requireAuthenticatedUser(
    client?: SupabaseClient
  ): Promise<AuthenticatedContext> {
    const { user, profile, isAdmin: isUserAdmin } =
      await AuthService.getCurrentUserWithProfile(client);

    if (!user || !profile) {
      redirect("/auth/login");
    }

    return {
      user,
      profile,
      isAdmin: isUserAdmin,
    };
  },

  /**
   * Enforces that the request is made by an authorized administrator.
   * Redirects unauthenticated requests to `/auth/login` and non-admin users to `/unauthorized`.
   */
  async requireAdmin(
    client?: SupabaseClient
  ): Promise<AuthenticatedContext> {
    const { user, profile, isAdmin: isUserAdmin } =
      await AuthService.getCurrentUserWithProfile(client);

    if (!user || !profile) {
      redirect("/auth/login");
    }

    if (!isUserAdmin) {
      redirect("/unauthorized");
    }

    return {
      user,
      profile,
      isAdmin: true,
    };
  },
};
