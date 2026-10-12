# Shared Types (`src/types`)

## Purpose
The `types` directory holds shared TypeScript domain models, database schema contracts, API transfer types, and operational interfaces.

## Contents
- **`common.ts`**: Universal types like `Result<T, E>`, `PaginationParams`, `PaginatedResult<T>`, and `BaseEntity`.
- **`index.ts`**: Barrel export for convenient imports via `@/types`.

## Rules & Conventions
- Pure TypeScript type and interface declarations only (no runtime side effects).
- Shared domain types live here; feature-scoped types live within `src/features/<feature>/types/`.
- File names use kebab-case (`common.ts`, `payroll.ts`).
