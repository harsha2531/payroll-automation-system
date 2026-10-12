# Shared Infrastructure & Utilities (`src/lib`)

## Purpose
The `lib` directory contains shared infrastructure, low-level technical utilities, third-party client wrappers, and system configuration.

## Contents
- **`utils.ts`**: Common general helpers (e.g., `cn` class merger).
- **`format.ts`**: Universal string/number/currency/date formatters.
- **`supabase/`**: Supabase client initialization (client-side and server-side).

## Rules & Conventions
- Pure utility functions should be deterministic and easy to unit test.
- Server-specific infrastructure modules must include `import "server-only";` (e.g., `src/lib/supabase/server.ts`).
- Avoid putting complex business logic or multi-table queries here; those belong in `services/`.
