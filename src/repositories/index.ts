import "server-only";

/**
 * Repositories Layer
 *
 * Encapsulates database queries, schema mapping, and persistence operations.
 *
 * Rules:
 * - Must always execute on the server.
 * - Must never be imported into Client Components.
 * - Imports "server-only" to guarantee compile-time isolation.
 */

export * from "./profile.repository";
