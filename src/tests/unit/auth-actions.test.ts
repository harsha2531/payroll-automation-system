import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loginAction,
  signUpAction,
  forgotPasswordAction,
  updatePasswordAction,
  logoutAction,
  getUserProfileAction,
} from "@/features/auth/actions";

// Mock next/navigation
const mockRedirect = vi.fn((url: string) => {
  const error = new Error("NEXT_REDIRECT");
  (error as unknown as { digest: string; url: string }).digest = "NEXT_REDIRECT";
  (error as unknown as { digest: string; url: string }).url = url;
  throw error;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase Server Client
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();

const mockSupabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    signOut: mockSignOut,
    getUser: mockGetUser,
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

// Mock client env
vi.mock("@/lib/env/client", () => ({
  getClientEnv: vi.fn(() => ({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
  })),
}));

describe("Auth Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loginAction", () => {
    it("returns validation errors without calling Supabase when inputs are invalid", async () => {
      const result = await loginAction({ email: "invalid-email", password: "" });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it("returns mapped error when Supabase signInWithPassword fails", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: null,
        error: new Error("invalid_grant"),
      });

      const result = await loginAction({
        email: "user@example.com",
        password: "password123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid email or password");
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });

    it("returns success: true when Supabase authentication succeeds", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: { id: "user_123" }, session: {} },
        error: null,
      });

      const result = await loginAction({
        email: "user@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("signUpAction", () => {
    it("rejects mismatched passwords before calling Supabase", async () => {
      const result = await signUpAction({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password456",
        fullName: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors?.confirmPassword).toBeDefined();
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("calls Supabase signUp with metadata and emailRedirectTo", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: "new_user" },
          session: null, // confirmation required
        },
        error: null,
      });

      const result = await signUpAction({
        email: "newuser@example.com",
        password: "password123",
        confirmPassword: "password123",
        fullName: "New User",
      });

      expect(result.success).toBe(true);
      expect(result.data?.emailConfirmationRequired).toBe(true);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "newuser@example.com",
        password: "password123",
        options: {
          data: { full_name: "New User" },
          emailRedirectTo: "http://localhost:3000/auth/confirm?next=/protected",
        },
      });
    });

    it("handles signups where auto-confirmation / session is immediately provided", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: "new_user" },
          session: { access_token: "tok123" },
        },
        error: null,
      });

      const result = await signUpAction({
        email: "auto@example.com",
        password: "password123",
        confirmPassword: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.data?.emailConfirmationRequired).toBe(false);
    });

    it("returns mapped error when user is already registered", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error("User already registered"),
      });

      const result = await signUpAction({
        email: "existing@example.com",
        password: "password123",
        confirmPassword: "password123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("forgotPasswordAction", () => {
    it("returns validation error on invalid email", async () => {
      const result = await forgotPasswordAction({ email: "bad-email" });

      expect(result.success).toBe(false);
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("anti-enumeration: returns success even if Supabase returns an error", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        data: null,
        error: new Error("User not found"),
      });

      const result = await forgotPasswordAction({ email: "nonexistent@company.com" });

      expect(result.success).toBe(true);
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "nonexistent@company.com",
        {
          redirectTo: "http://localhost:3000/auth/confirm?type=recovery&next=/auth/update-password",
        }
      );
    });

    it("returns success when reset email is dispatched", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const result = await forgotPasswordAction({ email: "user@company.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("updatePasswordAction", () => {
    it("rejects mismatched passwords before calling Supabase", async () => {
      const result = await updatePasswordAction({
        password: "newPassword123",
        confirmPassword: "differentPassword123",
      });

      expect(result.success).toBe(false);
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("calls Supabase updateUser with new password", async () => {
      mockUpdateUser.mockResolvedValueOnce({
        data: { user: { id: "user_1" } },
        error: null,
      });

      const result = await updatePasswordAction({
        password: "newPassword123",
        confirmPassword: "newPassword123",
      });

      expect(result.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newPassword123" });
    });

    it("returns mapped error on Supabase failure", async () => {
      mockUpdateUser.mockResolvedValueOnce({
        data: null,
        error: new Error("Token has expired"),
      });

      const result = await updatePasswordAction({
        password: "newPassword123",
        confirmPassword: "newPassword123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("logoutAction", () => {
    it("calls signOut and redirects to /auth/login", async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
    });
  });

  describe("getUserProfileAction", () => {
    it("returns null when user is unauthenticated or error occurs", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Session expired"),
      });

      const profile = await getUserProfileAction();
      expect(profile).toBeNull();
    });

    it("returns mapped profile when user is authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user_456",
            email: "sarah.connor@cyber.com",
            user_metadata: { full_name: "Sarah Connor" },
            app_metadata: { role: "admin" },
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      const profile = await getUserProfileAction();
      expect(profile).not.toBeNull();
      expect(profile?.displayName).toBe("Sarah Connor");
      expect(profile?.role).toBe("admin");
      expect(profile?.email).toBe("sarah.connor@cyber.com");
    });
  });
});
