# Shared Infrastructure & Utilities (`src/lib`)

## Purpose
The `lib` directory contains shared infrastructure, low-level technical utilities, third-party client wrappers, and system configuration.

## Contents
- **`env/`**: Centralized environment variable validation system:
  - `schema.ts`: Zod validation schemas for browser-safe (`NEXT_PUBLIC_*`) and server-only variables, secret leak security rules, and error sanitization.
  - `client.ts`: Safe environment accessor for Client & Server components (`getClientEnv()`).
  - `server.ts`: Server-only environment accessor (`getServerEnv()`) protected by `"server-only"`.
- **`utils.ts`**: Common general helpers (e.g., `cn` class merger).
- **`format.ts`**: Universal string/number/currency/date formatters.
- **`supabase/`**: Supabase client initialization (client-side and server-side).

## Rules & Conventions
- Pure utility functions should be deterministic and easy to unit test.
- Server-specific infrastructure modules must include `import "server-only";` (e.g., `src/lib/supabase/server.ts`, `src/lib/env/server.ts`).
- Server secrets must never be exposed or prefixed with `NEXT_PUBLIC_`.
- Avoid putting complex business logic or multi-table queries here; those belong in `services/`.
