"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getClientEnv } from "@/lib/env/client";
import {
  validateLoginInput,
  validateSignUpInput,
  validateForgotPasswordInput,
  validateUpdatePasswordInput,
} from "./validation";
import { mapAuthError } from "./error-mapping";
import { mapUserProfile, type UserProfile } from "./profile";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import { ProfileRepository } from "@/repositories/profile.repository";
import { isValidRole } from "./roles";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Server action to log in a user with email and password.
 * Performs server-side input validation and sets session cookies.
 */
export async function loginAction(formData: {
  email?: string;
  password?: string;
}): Promise<ActionResult> {
  const validation = validateLoginInput(formData);
  if (!validation.success) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please correct the highlighted errors.",
    };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error: mapAuthError(error),
    };
  }

  return { success: true };
}

/**
 * Server action to sign up a new user with email and password.
 */
export async function signUpAction(formData: {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
}): Promise<ActionResult<{ emailConfirmationRequired: boolean }>> {
  const validation = validateSignUpInput(formData);
  if (!validation.success) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please correct the highlighted errors.",
    };
  }

  const { email, password, fullName } = validation.data;
  const env = getClientEnv();
  const supabase = await createClient();

  const emailRedirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/protected`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || undefined,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      success: false,
      error: mapAuthError(error),
    };
  }

  // If session is immediately returned (e.g. email confirmation disabled in dev), user is signed in
  const emailConfirmationRequired = !data.session;

  return {
    success: true,
    data: { emailConfirmationRequired },
  };
}

/**
 * Server action to request a password reset email.
 * Security: Always reports success to prevent account enumeration.
 */
export async function forgotPasswordAction(formData: {
  email?: string;
}): Promise<ActionResult> {
  const validation = validateForgotPasswordInput(formData);
  if (!validation.success) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please enter a valid email address.",
    };
  }

  const { email } = validation.data;
  const env = getClientEnv();
  const supabase = await createClient();

  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?type=recovery&next=/auth/update-password`;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Log for diagnostics on server without exposing account existence to client
      console.warn("Password reset request error:", error.message);
    }
  } catch (err) {
    console.warn("Password reset unexpected error:", err);
  }

  // Always return success to protect against user enumeration
  return {
    success: true,
  };
}

/**
 * Server action to update the user's password once in a recovery session.
 */
export async function updatePasswordAction(formData: {
  password?: string;
  confirmPassword?: string;
}): Promise<ActionResult> {
  const validation = validateUpdatePasswordInput(formData);
  if (!validation.success) {
    return {
      success: false,
      fieldErrors: validation.errors,
      error: "Please correct the highlighted errors.",
    };
  }

  const { password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      success: false,
      error: mapAuthError(error),
    };
  }

  return { success: true };
}

/**
 * Server action to log out the current user and redirect to login.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

/**
 * Server action to fetch the current authenticated user's profile from trusted database table.
 */
export async function getUserProfileAction(): Promise<UserProfile | null> {
  const { profile } = await AuthService.getCurrentUserWithProfile();
  return profile;
}

/**
 * Server action to update the user's own profile (fullName, avatarUrl).
 * Security: Strictly prevents self-promotion by ignoring/excluding any role input.
 */
export async function updateProfileAction(data: {
  fullName?: string;
  avatarUrl?: string;
  role?: unknown; // Explicitly ignored to prevent self-promotion
}): Promise<ActionResult<UserProfile>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "You must be signed in to update your profile.",
    };
  }

  // Security: only pass non-privileged fields
  const updateResult = await ProfileRepository.updateProfile(supabase, user.id, {
    fullName: data.fullName?.trim(),
    avatarUrl: data.avatarUrl?.trim(),
  });

  if (!updateResult.success) {
    return {
      success: false,
      error: updateResult.error,
    };
  }

  const updatedProfile = mapUserProfile(user, updateResult.data);
  return {
    success: true,
    data: updatedProfile,
  };
}

/**
 * Administrative server action to assign/change a user's role.
 * Security: Strictly enforces that only authorized administrators can call this action.
 */
export async function assignUserRoleAction(data: {
  targetUserId: string;
  role: string;
}): Promise<ActionResult> {
  const { isAdmin: isCallerAdmin } = await AuthService.getCurrentUserWithProfile();

  if (!isCallerAdmin) {
    return {
      success: false,
      error: "Forbidden: Only administrators can modify user roles.",
    };
  }

  if (!isValidRole(data.role)) {
    return {
      success: false,
      error: "Invalid role specified. Role must be 'admin' or 'employee'.",
    };
  }

  if (!data.targetUserId || typeof data.targetUserId !== "string") {
    return {
      success: false,
      error: "Target user ID is required.",
    };
  }

  // Perform role update using admin client
  const adminClient = createAdminClient();
  const result = await ProfileRepository.updateUserRole(
    adminClient,
    data.targetUserId,
    data.role
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  // Also sync app_metadata so Supabase Auth claims immediately reflect the updated role
  await adminClient.auth.admin.updateUserById(data.targetUserId, {
    app_metadata: { role: data.role },
  });

  return { success: true };
}
