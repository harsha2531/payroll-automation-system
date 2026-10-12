# Data Repositories (`src/repositories`)

## Purpose
The `repositories` directory encapsulates direct database access, data queries, schema mapping, and persistence abstractions.

## Rules & Conventions
- **Server-Only Enforcement**: Every repository module must include `import "server-only";` at the top of the file.
- **Single Responsibility**: Each repository corresponds to a distinct data model or storage table.
- **Naming**: Named with kebab-case ending in `.repository.ts` (e.g., `employee.repository.ts`).
- **Encapsulation**: Raw SQL / Supabase queries stay inside repositories rather than leaking into React components or page handlers.
