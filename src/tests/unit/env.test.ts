import { describe, it, expect } from "vitest";
import {
  parseClientEnv,
  parseServerEnv,
  validateNoPublicSecrets,
} from "@/lib/env/schema";

const validFakeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://mock-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key-xyz123",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-secret-key-456",
  BREVO_API_KEY: "mock-brevo-api-key-789",
  BREVO_SENDER_EMAIL: "payroll@company.test",
  BREVO_SENDER_NAME: "Company Payroll",
  NODE_ENV: "test" as const,
};

describe("Environment Configuration System", () => {
  describe("1. Valid Required Configuration", () => {
    it("successfully validates and parses complete server environment", () => {
      const result = parseServerEnv(validFakeEnv);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.NEXT_PUBLIC_SUPABASE_URL).toBe(validFakeEnv.NEXT_PUBLIC_SUPABASE_URL);
      expect(result.data?.BREVO_SENDER_EMAIL).toBe(validFakeEnv.BREVO_SENDER_EMAIL);
      expect(result.data?.SUPABASE_SERVICE_ROLE_KEY).toBe(validFakeEnv.SUPABASE_SERVICE_ROLE_KEY);
    });
  });

  describe("2. Missing Required Configuration", () => {
    it("fails validation when a required server secret is missing", () => {
      const envWithMissingSecret = { ...validFakeEnv };
      delete (envWithMissingSecret as Partial<typeof validFakeEnv>).BREVO_API_KEY;

      const result = parseServerEnv(envWithMissingSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("[BREVO_API_KEY]: BREVO_API_KEY is required");
      // Ensure no secrets are leaked in the error output
      expect(result.error).not.toContain("mock-service-role-secret-key-456");
    });

    it("fails validation when required Supabase service role key is missing", () => {
      const envWithoutSupabaseSecret = { ...validFakeEnv };
      delete (envWithoutSupabaseSecret as Partial<typeof validFakeEnv>).SUPABASE_SERVICE_ROLE_KEY;

      const result = parseServerEnv(envWithoutSupabaseSecret);

      expect(result.success).toBe(false);
      expect(result.error).toContain("[SUPABASE_SERVICE_ROLE_KEY]: SUPABASE_SERVICE_ROLE_KEY is required");
    });

    it("fails validation when required client URL is missing", () => {
      const envWithoutUrl = { ...validFakeEnv };
      delete (envWithoutUrl as Partial<typeof validFakeEnv>).NEXT_PUBLIC_SUPABASE_URL;

      const result = parseServerEnv(envWithoutUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain("[NEXT_PUBLIC_SUPABASE_URL]: NEXT_PUBLIC_SUPABASE_URL is required");
    });
  });

  describe("3. Invalid Configuration", () => {
    it("fails validation when Supabase URL is malformed", () => {
      const invalidEnv = {
        ...validFakeEnv,
        NEXT_PUBLIC_SUPABASE_URL: "invalid-url-without-protocol",
      };

      const result = parseServerEnv(invalidEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be a valid HTTP or HTTPS URL");
      // Error message should identify the problematic field without exposing value
      expect(result.error).toContain("[NEXT_PUBLIC_SUPABASE_URL]");
    });

    it("fails validation when Brevo sender email is not a valid email address", () => {
      const invalidEnv = {
        ...validFakeEnv,
        BREVO_SENDER_EMAIL: "not-an-email-address",
      };

      const result = parseServerEnv(invalidEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be a valid email address");
      expect(result.error).toContain("[BREVO_SENDER_EMAIL]");
    });
  });

  describe("4. Server-Only Configuration Protection", () => {
    it("client schema does not require or expose server-only secrets", () => {
      const clientOnlyEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mock-pub-key",
      };

      const result = parseClientEnv(clientOnlyEnv);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
      expect(result.data).not.toHaveProperty("BREVO_API_KEY");
    });

    it("throws security error if a secret is prefixed with NEXT_PUBLIC_", () => {
      const leakedSecretEnv = {
        ...validFakeEnv,
        NEXT_PUBLIC_BREVO_API_KEY: "secret-brevo-value",
      };

      expect(() => {
        validateNoPublicSecrets(leakedSecretEnv);
      }).toThrow(/Security violation: Secret variables must not be exposed with NEXT_PUBLIC_ prefix/);
    });

    it("throws security error if service role key is prefixed with NEXT_PUBLIC_", () => {
      const leakedSecretEnv = {
        ...validFakeEnv,
        NEXT_PUBLIC_SERVICE_ROLE_KEY: "secret-service-role",
      };

      expect(() => {
        validateNoPublicSecrets(leakedSecretEnv);
      }).toThrow(/NEXT_PUBLIC_SERVICE_ROLE_KEY/);
    });
  });

  describe("5. Browser-Safe Configuration", () => {
    it("successfully validates browser-safe variables and applies defaults", () => {
      const clientEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://mock-frontend.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mock-client-anon-key",
      };

      const result = parseClientEnv(clientEnv);

      expect(result.success).toBe(true);
      expect(result.data?.NEXT_PUBLIC_SUPABASE_URL).toBe("https://mock-frontend.supabase.co");
      expect(result.data?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("mock-client-anon-key");
      expect(result.data?.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    });

    it("fails browser-safe validation when required public key is missing", () => {
      const result = parseClientEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://mock-frontend.supabase.co",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
    });
  });
});
