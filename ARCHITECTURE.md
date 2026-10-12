# Project Architecture: Payroll Automation System

This document outlines the architectural foundation and engineering conventions for the Payroll Automation application.

---

## 1. Directory Structure Overview

The application follows a clean, feature-oriented and layered architecture located under `src/`:

```
src/
├── app/              # Next.js App Router (pages, layouts, route handlers)
├── components/       # Shared presentation UI components (primitives, shell)
├── features/         # Feature-specific modular application code
├── lib/              # Shared infrastructure, client configurations, and utilities
├── services/         # Server-side business logic and external integrations
├── repositories/     # Server-side database access abstractions
├── types/            # Shared TypeScript domain models and utility types
└── tests/            # Test setups, smoke tests, and shared test utilities
```

---

## 2. Layer Responsibilities & Boundaries

| Directory | Layer | Environment | Responsibility | Example |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/` | Routing & Presentation | Server / Client | Route declarations, layouts, server-rendered views, API endpoints | `src/app/page.tsx` |
| `src/components/` | Presentation UI | Client & Server | Reusable UI widgets and application shell layout | `src/components/app-shell/` |
| `src/features/` | Feature Slices | Client & Server | Feature-scoped components, hooks, and local helpers | `src/features/<feature>/` |
| `src/lib/` | Infrastructure | Client / Server | Third-party clients (Supabase), shared general helpers | `src/lib/format.ts`, `src/lib/utils.ts` |
| `src/services/` | Business Logic | Server Only | Workflow coordination, business rules, external service integrations | `src/services/<domain>.service.ts` |
| `src/repositories/`| Data Access | Server Only | Database queries, schema serialization, CRUD abstraction | `src/repositories/<entity>.repository.ts` |
| `src/types/` | Type System | Build/Compile | Shared interfaces, domain types, result patterns | `src/types/common.ts` |
| `src/tests/` | Quality Assurance | Test Runner | Test environment setup, fixtures, smoke tests | `src/tests/smoke/` |

---

## 3. Client vs. Server Code Isolation

To enforce strict security and prevent leaking sensitive database code, environment keys, or internal logic into client bundles:

1. **`server-only` Package Enforcement**:
   - All modules in `src/services/`, `src/repositories/`, and server infrastructure (e.g. `src/lib/supabase/server.ts`) must include `import "server-only";` at the top of the file.
   - If any Client Component or browser code inadvertently imports a server-only module, the build halts with a compile error.

2. **Client Components**:
   - Any component requiring browser APIs (state, effects, browser events) must explicitly declare `'use client';` at the top.

3. **Data Flow**:
   - Browser Client -> Server Action / Route Handler (`app/`) -> Service (`services/`) -> Repository (`repositories/`) -> Database (Supabase).

---

## 4. Naming Conventions

- **Files & Directories**: Kebab-case (`app-shell.tsx`, `format.ts`, `common.ts`).
- **React Components**: PascalCase (`AppHeader`, `AppShell`, `Button`).
- **Functions & Utilities**: camelCase (`formatCurrency`, `formatDate`, `cn`).
- **Interfaces & Types**: PascalCase (`Result`, `BaseEntity`, `PaginationParams`).
- **Services**: Kebab-case with `.service.ts` suffix (`payroll.service.ts`).
- **Repositories**: Kebab-case with `.repository.ts` suffix (`employee.repository.ts`).
- **Tests**: Mirror target file or function with `.test.ts` or `.test.tsx` suffix.

---

## 5. Adding New Features

When implementing new features (e.g., employee management, payroll processing):
1. Create a dedicated folder in `src/features/<feature-name>/`.
2. Encapsulate feature-specific UI, hooks, and local helpers inside the feature folder.
3. Place backend business logic into `src/services/` and database persistence into `src/repositories/`.
4. Define domain entity types in `src/types/` or `src/features/<feature-name>/types/`.
