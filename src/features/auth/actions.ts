"use server";

import { createClient } from "@/lib/supabase/server";
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
 * Server action to fetch the current authenticated user's profile.
 */
export async function getUserProfileAction(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return mapUserProfile(data.user);
}
