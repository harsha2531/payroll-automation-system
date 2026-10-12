/**
 * Centralized Environment Configuration System.
 *
 * Provides typed access to validated environment variables while strictly
 * maintaining isolation between browser-safe and server-only configurations.
 */

export * from "./schema";
export { getClientEnv } from "./client";
// Note: getServerEnv is intentionally not exported from index.ts to prevent
// accidental bundling into client builds. Server code should import from "@/lib/env/server".
