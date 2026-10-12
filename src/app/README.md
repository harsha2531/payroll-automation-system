# App Router Directory (`src/app`)

## Purpose
The `app` directory uses the Next.js App Router to define application routing, layouts, pages, and API route handlers.

## Contents
- **`layout.tsx`**: Root layout defining HTML structure, global fonts, and root providers.
- **`page.tsx`**: Top-level page routes.
- **`globals.css`**: Global CSS styling and Tailwind design tokens.
- **Route Handlers (`route.ts`)**: Server-side HTTP endpoints.

## Rules & Conventions
- Routes should remain thin and delegate complex business logic to `services/` and UI layout to `components/` or `features/`.
- Client Components must be explicitly declared with `'use client'`.
- Server Components are the default.
