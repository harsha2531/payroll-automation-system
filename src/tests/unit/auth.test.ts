import { describe, it, expect } from "vitest";
import {
  validateLoginInput,
  validateSignUpInput,
  validateForgotPasswordInput,
  validateUpdatePasswordInput,
} from "@/features/auth/validation";
import { mapAuthError } from "@/features/auth/error-mapping";
import { mapUserProfile } from "@/features/auth/profile";
import type { User } from "@supabase/supabase-js";

describe("Auth Validation", () => {
  describe("validateLoginInput", () => {
    it("accepts valid email and password", () => {
      const result = validateLoginInput({
        email: "payroll.admin@company.com",
        password: "securePassword123!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("payroll.admin@company.com");
        expect(result.data.password).toBe("securePassword123!");
      }
    });

    it("rejects empty or whitespace-only email", () => {
      const result = validateLoginInput({
        email: "   ",
        password: "securePassword123!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });

    it("rejects invalid email formats", () => {
      const result = validateLoginInput({
        email: "not-an-email",
        password: "securePassword123!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toContain("valid email");
      }
    });

    it("rejects empty password", () => {
      const result = validateLoginInput({
        email: "admin@company.com",
        password: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toBeDefined();
      }
    });

    it("handles null / undefined / empty input object", () => {
      const result = validateLoginInput({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
        expect(result.errors.password).toBeDefined();
      }
    });
  });

  describe("validateSignUpInput", () => {
    it("accepts valid signup input with matching passwords", () => {
      const result = validateSignUpInput({
        email: "new.hire@company.com",
        password: "ValidPassword123",
        confirmPassword: "ValidPassword123",
        fullName: "Jane Doe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("new.hire@company.com");
        expect(result.data.fullName).toBe("Jane Doe");
      }
    });

    it("accepts signup without optional fullName", () => {
      const result = validateSignUpInput({
        email: "new.hire@company.com",
        password: "ValidPassword123",
        confirmPassword: "ValidPassword123",
      });

      expect(result.success).toBe(true);
    });

    it("rejects when passwords do not match", () => {
      const result = validateSignUpInput({
        email: "new.hire@company.com",
        password: "ValidPassword123",
        confirmPassword: "DifferentPassword123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.confirmPassword).toContain("Passwords do not match");
      }
    });

    it("rejects password shorter than 6 characters", () => {
      const result = validateSignUpInput({
        email: "new.hire@company.com",
        password: "12345",
        confirmPassword: "12345",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toContain("at least 6 characters");
      }
    });

    it("rejects password longer than 72 characters", () => {
      const longPass = "a".repeat(73);
      const result = validateSignUpInput({
        email: "new.hire@company.com",
        password: longPass,
        confirmPassword: longPass,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toBeDefined();
      }
    });
  });

  describe("validateForgotPasswordInput", () => {
    it("accepts a valid email address", () => {
      const result = validateForgotPasswordInput({
        email: "reset.user@company.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("reset.user@company.com");
      }
    });

    it("rejects missing or empty email", () => {
      const result = validateForgotPasswordInput({ email: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });

    it("rejects invalid email syntax", () => {
      const result = validateForgotPasswordInput({ email: "invalid-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toContain("valid email");
      }
    });
  });

  describe("validateUpdatePasswordInput", () => {
    it("accepts valid new password matching confirmation", () => {
      const result = validateUpdatePasswordInput({
        password: "NewSecurePassword123",
        confirmPassword: "NewSecurePassword123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe("NewSecurePassword123");
      }
    });

    it("rejects mismatched passwords", () => {
      const result = validateUpdatePasswordInput({
        password: "NewSecurePassword123",
        confirmPassword: "MismatchPassword123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.confirmPassword).toContain("Passwords do not match");
      }
    });

    it("rejects password shorter than 6 characters", () => {
      const result = validateUpdatePasswordInput({
        password: "123",
        confirmPassword: "123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toContain("at least 6 characters");
      }
    });
  });
});

describe("Auth Error Mapping", () => {
  it("maps invalid credentials to clear message", () => {
    expect(mapAuthError(new Error("invalid_grant"))).toBe(
      "Invalid email or password. Please verify your credentials."
    );
    expect(mapAuthError(new Error("Invalid login credentials"))).toBe(
      "Invalid email or password. Please verify your credentials."
    );
  });

  it("maps already registered error", () => {
    expect(mapAuthError(new Error("User already registered"))).toBe(
      "An account with this email address already exists."
    );
  });

  it("maps unconfirmed email error", () => {
    expect(mapAuthError(new Error("Email not confirmed"))).toBe(
      "Please confirm your email address before signing in. Check your inbox for the confirmation link."
    );
  });

  it("maps expired token error", () => {
    expect(mapAuthError(new Error("Token has expired"))).toBe(
      "The verification link has expired. Please request a new one."
    );
    expect(mapAuthError(new Error("otp_expired"))).toBe(
      "The verification link has expired. Please request a new one."
    );
  });

  it("maps rate limit error", () => {
    expect(mapAuthError(new Error("over_email_send_rate_limit"))).toBe(
      "Too many attempts. Please wait a few moments and try again."
    );
    expect(mapAuthError(new Error("rate_limit"))).toBe(
      "Too many attempts. Please wait a few moments and try again."
    );
  });

  it("maps network connection error", () => {
    expect(mapAuthError(new Error("Failed to fetch"))).toBe(
      "Network error. Please check your internet connection."
    );
  });

  it("handles string error inputs", () => {
    expect(mapAuthError("Invalid login credentials")).toBe(
      "Invalid email or password. Please verify your credentials."
    );
  });

  it("handles null / undefined / unknown errors gracefully", () => {
    expect(mapAuthError(null)).toBe(
      "An unexpected error occurred. Please try again."
    );
    expect(mapAuthError(undefined)).toBe(
      "An unexpected error occurred. Please try again."
    );
    expect(mapAuthError(new Error("some totally exotic error"))).toBe(
      "An unexpected error occurred. Please try again."
    );
  });
});

describe("Auth Profile Mapping", () => {
  const baseUser: User = {
    id: "usr_12345",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    email: "john.doe@company.com",
    last_sign_in_at: "2026-03-01T12:00:00.000Z",
  };

  it("extracts full_name when present in user_metadata", () => {
    const user: User = {
      ...baseUser,
      user_metadata: { full_name: "Jane Smith" },
    };

    const profile = mapUserProfile(user);
    expect(profile.displayName).toBe("Jane Smith");
    expect(profile.email).toBe("john.doe@company.com");
    expect(profile.role).toBe("employee");
    expect(profile.id).toBe("usr_12345");
  });

  it("extracts name when full_name is absent", () => {
    const user: User = {
      ...baseUser,
      user_metadata: { name: "Bob Martin" },
    };

    const profile = mapUserProfile(user);
    expect(profile.displayName).toBe("Bob Martin");
  });

  it("extracts first_name and last_name using formatDisplayName", () => {
    const user: User = {
      ...baseUser,
      user_metadata: { first_name: "Alice", last_name: "Wonder" },
    };

    const profile = mapUserProfile(user);
    expect(profile.displayName).toBe("Alice Wonder");
  });

  it("falls back to capitalised email username when no metadata name provided", () => {
    const user: User = {
      ...baseUser,
      user_metadata: {},
      email: "finance.lead@company.com",
    };

    const profile = mapUserProfile(user);
    expect(profile.displayName).toBe("Finance.lead");
  });

  it("extracts role from app_metadata when valid", () => {
    const user: User = {
      ...baseUser,
      app_metadata: { role: "admin" },
    };

    const profile = mapUserProfile(user);
    expect(profile.role).toBe("admin");
  });

  it("strictly ignores role in user_metadata to prevent self-promotion", () => {
    const user: User = {
      ...baseUser,
      user_metadata: { role: "admin" }, // Attacker trying to self-promote via metadata
    };

    const profile = mapUserProfile(user);
    expect(profile.role).toBe("employee"); // Must default safely to employee
  });

  it("resolves role and full name from trusted database profile record", () => {
    const user: User = { ...baseUser };
    const profile = mapUserProfile(user, {
      role: "admin",
      fullName: "Super Admin",
    });

    expect(profile.role).toBe("admin");
    expect(profile.displayName).toBe("Super Admin");
  });

  it("defaults role to employee when no role specified", () => {
    const user: User = {
      ...baseUser,
      app_metadata: {},
      user_metadata: {},
    };

    const profile = mapUserProfile(user);
    expect(profile.role).toBe("employee");
  });

  it("handles user without email", () => {
    const user: User = {
      ...baseUser,
      email: undefined,
    };

    const profile = mapUserProfile(user);
    expect(profile.displayName).toBe("User");
    expect(profile.email).toBe("");
  });
});

import { isAdmin, isValidRole, assertAdmin } from "@/features/auth/roles";

describe("Role Authorization Utility (src/features/auth/roles.ts)", () => {
  it("isAdmin returns true for admin and false otherwise", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("employee")).toBe(false);
    expect(isAdmin("")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("isValidRole recognizes valid roles", () => {
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("employee")).toBe(true);
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });

  it("assertAdmin throws for non-admin and passes for admin", () => {
    expect(() => assertAdmin("admin")).not.toThrow();
    expect(() => assertAdmin("employee")).toThrow(/Administrator privileges required/);
    expect(() => assertAdmin(null)).toThrow(/Administrator privileges required/);
  });
});
