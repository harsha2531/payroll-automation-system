import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "@/services/auth.service";
import { ProfileRepository } from "@/repositories/profile.repository";
import {
  updateProfileAction,
  assignUserRoleAction,
} from "@/features/auth/actions";
import fs from "fs";
import path from "path";

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

// Mock Supabase clients
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
  auth: {
    getUser: mockGetUser,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  from: mockFrom,
};

const mockAdminSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockAdminSupabase),
}));

vi.mock("@/lib/env/client", () => ({
  getClientEnv: vi.fn(() => ({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mock-anon-key",
  })),
}));

describe("Phase 2.3: Authorization & Security Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. AuthService Enforcement", () => {
    it("redirects unauthenticated users to /auth/login in requireAuthenticatedUser", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("No session"),
      });

      await expect(AuthService.requireAuthenticatedUser(mockSupabase as never)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
    });

    it("redirects unauthenticated users to /auth/login in requireAdmin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("No session"),
      });

      await expect(AuthService.requireAdmin(mockSupabase as never)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
    });

    it("redirects authenticated non-admin users to /unauthorized in requireAdmin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "emp_123",
            email: "employee@company.com",
            user_metadata: {},
            app_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      // Mock database profile returning employee role
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: "emp_123",
                email: "employee@company.com",
                full_name: "Regular Employee",
                role: "employee",
                avatar_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(AuthService.requireAdmin(mockSupabase as never)).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
    });

    it("allows authorized admin users to access requireAdmin", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "adm_999",
            email: "admin@company.com",
            user_metadata: {},
            app_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      // Mock database profile returning admin role
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: "adm_999",
                email: "admin@company.com",
                full_name: "System Admin",
                role: "admin",
                avatar_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      const context = await AuthService.requireAdmin(mockSupabase as never);
      expect(context.user.id).toBe("adm_999");
      expect(context.profile.role).toBe("admin");
      expect(context.isAdmin).toBe(true);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("2. Self-Promotion Prevention", () => {
    it("updateProfile in ProfileRepository never updates role column", async () => {
      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: "user_1",
                email: "user@company.com",
                full_name: "Updated Name",
                role: "employee",
                avatar_url: "https://photo.com/pic.jpg",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-02T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await ProfileRepository.updateProfile(
        mockSupabase as never,
        "user_1",
        {
          fullName: "Updated Name",
          avatarUrl: "https://photo.com/pic.jpg",
        }
      );

      expect(result.success).toBe(true);
      // Verify payload passed to Supabase update does NOT contain role!
      const updatePayload = mockUpdate.mock.calls[0][0];
      expect(updatePayload.role).toBeUndefined();
      expect(updatePayload.full_name).toBe("Updated Name");
      expect(updatePayload.avatar_url).toBe("https://photo.com/pic.jpg");
    });

    it("updateProfileAction ignores any role argument in client request", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user_hack",
            email: "hacker@company.com",
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: "user_hack",
                email: "hacker@company.com",
                full_name: "Legit Name",
                role: "employee",
                avatar_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-02T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({ update: mockUpdate });

      const result = await updateProfileAction({
        fullName: "Legit Name",
        role: "admin" as never, // Malicious attempt to self-promote
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.role).toBe("employee"); // Role must remain employee!
      }
      const updatePayload = mockUpdate.mock.calls[0][0];
      expect(updatePayload.role).toBeUndefined();
    });

    it("assignUserRoleAction blocks non-admin callers from modifying roles", async () => {
      // Mock caller as employee
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "emp_user",
            email: "emp@company.com",
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: "emp_user",
                email: "emp@company.com",
                full_name: "Emp",
                role: "employee",
                avatar_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await assignUserRoleAction({
        targetUserId: "target_user",
        role: "admin",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Forbidden");
    });

    it("assignUserRoleAction permits authorized admin to modify roles", async () => {
      // Mock caller as admin
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "admin_user",
            email: "admin@company.com",
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: "admin_user",
                email: "admin@company.com",
                full_name: "Admin",
                role: "admin",
                avatar_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock admin update
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: "target_user",
                  email: "target@company.com",
                  full_name: "Target",
                  role: "admin",
                  avatar_url: null,
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-02T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await assignUserRoleAction({
        targetUserId: "target_user",
        role: "admin",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("3. SQL Migration & Row Level Security Schema Review", () => {
    it("migration file exists and configures RLS and role protections", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261013000000_create_profiles_table.sql"
      );

      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Verify table creation
      expect(sql).toContain("create table if not exists public.profiles");
      expect(sql).toContain("role text not null default 'employee'");

      // Verify RLS enabled
      expect(sql).toContain("alter table public.profiles enable row level security");

      // Verify policies
      expect(sql).toContain("profiles_select_own");
      expect(sql).toContain("profiles_select_admin");
      expect(sql).toContain("profiles_update_own");
      expect(sql).toContain("profiles_service_role_all");

      // Verify triggers
      expect(sql).toContain("prevent_role_self_promotion");
      expect(sql).toContain("handle_new_user");
    });
  });
});
