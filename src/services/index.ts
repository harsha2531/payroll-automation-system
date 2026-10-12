import "server-only";

/**
 * Services Layer
 *
 * Encapsulates core business logic, workflow orchestration, and
 * external system integrations.
 *
 * Rules:
 * - Must always execute on the server.
 * - Must never be imported directly into Client Components.
 * - Imports "server-only" to guarantee compile-time isolation.
 */
