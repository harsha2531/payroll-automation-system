import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkSupabaseConfig,
  checkSupabaseConnection,
  sanitizeErrorMessage,
} from "@/lib/supabase/connection-check";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  createClient as createServerClient,
  createAdminClient,
} from "@/lib/supabase/server";
import { updateSession } from "@/lib/supabase/proxy";
import { resetClientEnvCache } from "@/lib/env/client";
import { resetServerEnvCache } from "@/lib/env/server";
import { NextRequest } from "next/server";

interface MockBrowserClient {
  type: string;
  url: string;
  key: string;
  auth: {
    getSession: () => Promise<{ data: { session: null }; error: null }>;
  };
}

interface MockServerClient {
  type: string;
  url: string;
  key: string;
  options: {
    cookies?: {
      getAll: () => unknown[];
      setAll: (cookiesToSet: unknown[]) => void;
    };
    auth: {
      persistSession: boolean;
      autoRefreshToken: boolean;
    };
  };
  auth: {
    getSession: () => Promise<{ data: { session: null }; error: null }>;
    getClaims: () => Promise<{ data: { claims: null }; error: null }>;
  };
}

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn((url: string, key: string): MockBrowserClient => ({
    type: "browser",
    url,
    key,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  })),
  createServerClient: vi.fn(
    (url: string, key: string, options: Record<string, unknown>): MockServerClient => ({
      type: "server",
      url,
      key,
      options: options as MockServerClient["options"],
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      },
    })
  ),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([{ name: "sb-mock-token", value: "token123" }]),
    set: vi.fn(),
  }),
}));

// Mock next/server to provide deterministic responses in JSDOM environment
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      next: vi.fn(() => {
        const cookies = new Map<string, { value: string; options?: unknown }>();
        return {
          status: 200,
          headers: new Headers(),
          cookies: {
            set: vi.fn((name: string, value: string, options?: unknown) =>
              cookies.set(name, { value, options })
            ),
            get: vi.fn((name: string) => cookies.get(name)),
            getAll: vi.fn(() => Array.from(cookies.values())),
          },
        };
      }),
      redirect: vi.fn((url: string | URL) => {
        const headers = new Headers();
        headers.set("location", url.toString());
        return {
          status: 307,
          headers,
          cookies: {
            set: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn().mockReturnValue([]),
          },
        };
      }),
    },
  };
});


const mockValidEnv: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_mock_key_12345",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.test-service-role.secret456",
  BREVO_API_KEY: "xkeysib-test-mock-key-789",
  BREVO_SENDER_EMAIL: "test@example.com",
  BREVO_SENDER_NAME: "Payroll Admin",
  NODE_ENV: "test",
};

describe("Phase 2.1: Supabase Setup & Integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetClientEnvCache();
    resetServerEnvCache();
    process.env = { ...originalEnv, ...mockValidEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetClientEnvCache();
    resetServerEnvCache();
  });

  describe("1. Supabase Configuration Check (checkSupabaseConfig)", () => {
    it("returns configured: true and extracts project host without leaking secret keys", () => {
      const config = checkSupabaseConfig(mockValidEnv);

      expect(config.configured).toBe(true);
      expect(config.projectHost).toBe("test-project.supabase.co");
      expect(config.hasPublishableKey).toBe(true);
      expect(config.hasServiceRoleKey).toBe(true);
      expect(config.error).toBeUndefined();

      // Ensure secret keys are NOT exposed in config check
      expect(JSON.stringify(config)).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(JSON.stringify(config)).not.toContain("sb_publishable_test_mock_key_12345");
    });

    it("returns configured: false when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
      const incompleteEnv = { ...mockValidEnv };
      delete incompleteEnv.NEXT_PUBLIC_SUPABASE_URL;

      const config = checkSupabaseConfig(incompleteEnv);

      expect(config.configured).toBe(false);
      expect(config.hasPublishableKey).toBe(false);
      expect(config.error).toContain("missing or invalid");
    });

    it("returns configured: false when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", () => {
      const incompleteEnv = { ...mockValidEnv };
      delete incompleteEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      const config = checkSupabaseConfig(incompleteEnv);

      expect(config.configured).toBe(false);
      expect(config.hasPublishableKey).toBe(false);
      expect(config.error).toContain("missing or invalid");
    });

    it("correctly indicates when SUPABASE_SERVICE_ROLE_KEY is absent", () => {
      const clientOnlyEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_key",
      };

      const config = checkSupabaseConfig(clientOnlyEnv);

      expect(config.configured).toBe(true);
      expect(config.hasPublishableKey).toBe(true);
      expect(config.hasServiceRoleKey).toBe(false);
    });

    it("fails gracefully with malformed URL", () => {
      const malformedEnv = {
        ...mockValidEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
      };

      const config = checkSupabaseConfig(malformedEnv);

      expect(config.configured).toBe(false);
      expect(config.error).toBeDefined();
    });
  });

  describe("2. Server Connection Check (checkSupabaseConnection)", () => {
    it("returns misconfigured status without attempting connection when env is incomplete", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      resetClientEnvCache();

      const result = await checkSupabaseConnection();

      expect(result.configured).toBe(false);
      expect(result.connected).toBe(false);
      expect(result.status).toBe("misconfigured");
      expect(result.message).toContain("Supabase configuration is missing or invalid");
    });

    it("returns connected: true when client auth check succeeds", async () => {
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      };

      const result = await checkSupabaseConnection(async () => mockClient);

      expect(result.configured).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.status).toBe("connected");
      expect(result.projectHost).toBe("test-project.supabase.co");
      expect(result.message).toContain("verified successfully");
    });

    it("returns connected: false and error message when auth check reports an error", async () => {
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: { message: "Invalid API key provided" },
          }),
        },
      };

      const result = await checkSupabaseConnection(async () => mockClient);

      expect(result.configured).toBe(true);
      expect(result.connected).toBe(false);
      expect(result.status).toBe("error");
      expect(result.error).toBe("Invalid API key provided");
    });

    it("catches thrown exceptions and sanitizes sensitive tokens from error message", async () => {
      const mockClient = () => {
        throw new Error(
          "Connection failed with token: eyJhbGciOiJIUzI1NiJ9.mockTokenPart.secretPart and key sb_publishable_secret123"
        );
      };

      const result = await checkSupabaseConnection(async () => mockClient());

      expect(result.configured).toBe(true);
      expect(result.connected).toBe(false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("[REDACTED_JWT]");
      expect(result.error).toContain("[REDACTED_KEY]");
      expect(result.error).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(result.error).not.toContain("sb_publishable_secret123");
    });
  });

  describe("3. Error Message Sanitization (sanitizeErrorMessage)", () => {
    it("redacts JWT strings, publishable keys, and api keys from text", () => {
      const raw =
        "Error in auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakKey with key sb_publishable_5l77GawrskQ and brevo xkeysib-1d37d5c6";
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitized).not.toContain("sb_publishable_5l77GawrskQ");
      expect(sanitized).not.toContain("xkeysib-1d37d5c6");
      expect(sanitized).toContain("[REDACTED_JWT]");
      expect(sanitized).toContain("[REDACTED_KEY]");
    });
  });

  describe("4. Browser Supabase Client (src/lib/supabase/client.ts)", () => {
    it("creates browser client using validated environment configuration", () => {
      const client = createBrowserClient() as unknown as MockBrowserClient;

      expect(client.type).toBe("browser");
      expect(client.url).toBe(mockValidEnv.NEXT_PUBLIC_SUPABASE_URL);
      expect(client.key).toBe(mockValidEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
      // Verify browser client never receives service role key
      expect(client.key).not.toBe(mockValidEnv.SUPABASE_SERVICE_ROLE_KEY);
    });

    it("throws clear validation error if public environment variables are missing", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      resetClientEnvCache();

      expect(() => createBrowserClient()).toThrow(
        /Environment configuration validation failed/
      );
    });
  });

  describe("5. Server Supabase Client (src/lib/supabase/server.ts)", () => {
    it("creates server client with cookie integration", async () => {
      const client = (await createServerClient()) as unknown as MockServerClient;

      expect(client.type).toBe("server");
      expect(client.url).toBe(mockValidEnv.NEXT_PUBLIC_SUPABASE_URL);
      expect(client.key).toBe(mockValidEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
      expect(client.options.cookies).toBeDefined();
      expect(typeof client.options.cookies?.getAll).toBe("function");
      expect(typeof client.options.cookies?.setAll).toBe("function");
    });

    it("creates admin client with service role key and disabled session persistence", () => {
      const adminClient = createAdminClient() as unknown as MockServerClient;

      expect(adminClient.type).toBe("server");
      expect(adminClient.url).toBe(mockValidEnv.NEXT_PUBLIC_SUPABASE_URL);
      expect(adminClient.key).toBe(mockValidEnv.SUPABASE_SERVICE_ROLE_KEY);
      expect(adminClient.options.auth.persistSession).toBe(false);
      expect(adminClient.options.auth.autoRefreshToken).toBe(false);
    });
  });

  describe("6. Session Cookie Handling in Proxy (src/lib/supabase/proxy.ts)", () => {
    it("passes request through when environment variables are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      const req = new NextRequest("http://localhost:3000/");
      const res = await updateSession(req);

      expect(res).toBeDefined();
      expect(res.status).toBe(200);
    });

    it("refreshes session and returns response when environment variables are set", async () => {
      const req = new NextRequest("http://localhost:3000/");
      const res = await updateSession(req);

      expect(res).toBeDefined();
      expect(res.status).toBe(200);
    });

    it("exempts /api/health paths from redirect when user is unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/supabase");
      const res = await updateSession(req);

      expect(res.status).not.toBe(307);
      expect(res.headers.get("location")).toBeNull();
    });
  });
});
