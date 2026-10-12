# Tests Directory (`src/tests`)

## Purpose
The `tests` directory houses test configuration, testing environment setups, shared mocks, test fixtures, and system/smoke tests.

## Structure
- **`setup.ts`**: Global Vitest configuration and DOM matchers extension.
- **`smoke/`**: Foundation smoke tests verifying layout, routing, and component integrity.
- **`unit/`**: Unit tests for shared utilities and services.
- **`fixtures/`**: Shared test fixtures and mock generators (for future use).

## Rules & Conventions
- Unit tests co-located with features may sit under `src/features/<feature>/__tests__/` or centrally in `src/tests/`.
- Test files use the `.test.ts` or `.test.tsx` extension.
