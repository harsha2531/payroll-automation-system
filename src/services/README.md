# Business & Application Services (`src/services`)

## Purpose
The `services` directory contains server-side business logic, multi-repository orchestration, and external system integrations (e.g., storage, email, document generation).

## Rules & Conventions
- **Server-Only Enforcement**: Every service module must include `import "server-only";` at the top of the file to guarantee it is never bundled into browser code.
- **Independence**: Services coordinate business logic by calling repositories or external client adapters, returning type-safe `Result<T>` values.
- **Naming**: Named with kebab-case ending in `.service.ts` (e.g., `payroll-calculation.service.ts`).
- **No Direct UI Dependencies**: Services must not import React components or client hooks.
