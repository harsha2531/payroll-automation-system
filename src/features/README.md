# Features Directory (`src/features`)

## Purpose
The `features` directory organizes application capabilities into modular, cohesive feature slices.

## Recommended Structure per Feature
When a feature is introduced (e.g., `payroll`, `employees`), it should follow a self-contained structure:
```
src/features/<feature-name>/
├── components/   # Feature-specific UI components
├── hooks/        # Feature-specific React hooks (if needed)
├── types/        # Feature-specific types and schemas
└── utils/        # Feature-specific utility helpers
```

## Rules & Conventions
- Code specific to a single business capability lives within that feature folder.
- If a component or utility becomes widely used across 3+ unrelated domains, promote it to `src/components/` or `src/lib/`.
- No fake or empty payroll modules should be created until that feature is explicitly scheduled and implemented.
