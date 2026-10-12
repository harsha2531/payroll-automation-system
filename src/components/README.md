# Components Directory (`src/components`)

## Purpose
The `components` directory holds reusable, presentation-only UI components shared across multiple routes and features.

## Contents
- **`app-shell/`**: Core application layout components (e.g., `AppHeader`, `AppSidebar`, `AppShell`).
- **`ui/`**: Low-level design system primitives (buttons, inputs, dialogs, badges).
- Generic utility UI components (e.g., `ThemeSwitcher`).

## Rules & Conventions
- Components in this folder must NOT contain domain/business rules or direct database calls.
- Component files are named using kebab-case (`app-header.tsx`, `theme-switcher.tsx`).
- Component exports use PascalCase (`AppHeader`, `ThemeSwitcher`).
