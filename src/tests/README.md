# Automated Testing Infrastructure (`src/tests`)

This directory houses test configuration, testing environment setups, shared mocks, test fixtures, and system/smoke tests for the payroll automation application.

## Directory Structure

```text
src/tests/
├── setup.ts              # Global Vitest configuration & DOM matchers
├── README.md             # Testing guide & conventions (this file)
├── smoke/                # High-level smoke tests (rendering, foundation, layout)
│   └── foundation-smoke.test.tsx
└── unit/                 # Pure unit tests (isolated utilities, schemas, services)
    ├── display-name.test.ts
    ├── env.test.ts
    └── format.test.ts
```

## Available Test Commands

| Command | Description | CI Ready |
|---|---|:---:|
| `npm test` | Runs the full test suite once (`vitest run`). | Yes |
| `npm run test:watch` | Starts Vitest in interactive watch mode for local development. | No |
| `npm run test:coverage` | Runs the test suite once with V8 coverage report generation. | Yes |

## Testing Principles & Constraints

1. **Deterministic & Isolated**: Unit tests must never depend on execution order or external state. Every test runs in isolation.
2. **Zero External Services / Credentials**: Unit tests must NEVER require real Supabase, Brevo, or third-party credentials. Use dummy/mock values only.
3. **No Network Calls**: Unit tests must never perform live network requests or external I/O.
4. **CI Compatibility**: Tests must run non-interactively and exit with appropriate exit codes (`0` for success, non-zero for failure).
5. **Coverage Reporting**: V8 coverage is configured to measure application logic in `src/lib`, `src/features`, `src/services`, and `src/repositories`, outputting reports to `./coverage`.

