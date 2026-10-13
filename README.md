# Payroll Automation System

A production-quality payroll automation application built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.

---

## Phase 2.1: Supabase Setup & Integration

Supabase integration provides database access, authentication session persistence, and storage services using the current recommended Next.js SSR architecture and `@supabase/ssr`.

### Architecture Overview

```text
src/
├── lib/
│   ├── env/                      # Centralized environment variable validation
│   │   ├── client.ts             # Browser-safe validated config (NEXT_PUBLIC_*)
│   │   ├── server.ts             # Server-only validated config (server-only secrets)
│   │   └── schema.ts             # Zod validation schemas and sanitization
│   └── supabase/
│       ├── client.ts             # Browser client (createBrowserClient)
│       ├── server.ts             # Server client & admin client (createServerClient)
│       ├── proxy.ts              # Session cookie handling & refresh
│       └── connection-check.ts   # Server-side connection & config validation
└── app/
    └── api/
        └── health/
            └── supabase/         # Healthcheck route handler (/api/health/supabase)
```

### Security & Isolation Guarantees

1. **Browser vs Server Isolation**:
   - `src/lib/supabase/client.ts` uses `createBrowserClient` with validated `NEXT_PUBLIC_*` variables. It never requests or has access to privileged server secrets.
   - `src/lib/supabase/server.ts` is guarded with `import "server-only";` and creates request-scoped server clients with cookie-based session management.
   - `createAdminClient()` (or `createServiceRoleClient()`) uses `SUPABASE_SERVICE_ROLE_KEY` to perform elevated backend operations. It is strictly server-only, never exposed to client code, and disables session persistence (`persistSession: false`).

2. **Session Cookie Handling & Refresh**:
   - Implemented in `src/lib/supabase/proxy.ts` according to the current `@supabase/ssr` recommendations.
   - Session cookies are read via `request.cookies.getAll()` and written via `response.cookies.setAll()`.
   - The user session is refreshed via `supabase.auth.getClaims()` during route requests to prevent out-of-sync authentication state.

3. **Connection & Configuration Health Check**:
   - Server-side check available via `checkSupabaseConnection()` and `GET /api/health/supabase`.
   - Checks both environment configuration validity and Supabase Auth service connectivity.
   - Strictly sanitizes all output and error messages so no secret keys, JWT tokens, or credentials are leaked.

---

## Local Setup & Configuration

### 1. Prerequisites
- Node.js 20+
- A Supabase project (create one free at [database.new](https://database.new))

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your project credentials in `.env.local`:

```env
# ------------------------------------------------------------------------------
# Browser-Safe Variables
# ------------------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ------------------------------------------------------------------------------
# Server-Only Variables (Keep confidential!)
# ------------------------------------------------------------------------------
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME="Payroll Automation System"
NODE_ENV=development
```

> [!NOTE]
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` supports Supabase's current **publishable** key format (`sb_publishable_...`) as well as legacy anon keys.
> Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.

### 3. Install Dependencies & Run Development Server

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application shell.

### 4. Verify Supabase Connectivity

- **Automated Health Check Route**: Visit [http://localhost:3000/api/health/supabase](http://localhost:3000/api/health/supabase) to view real-time server connectivity status.
- **Run Test Suite**: Run `npm test` to verify unit and smoke tests.

---

## Phase 2.2: Complete Authentication

The application provides a comprehensive, production-ready authentication implementation built on Next.js App Router, Server Actions, and Supabase SSR (`@supabase/ssr`).

### Features Implemented

1. **Email & Password Authentication**:
   - Login with email and password (`/auth/login`)
   - Signup with full name, email, and password confirmation (`/auth/sign-up`)
   - Logout via server action and client component with loading state
2. **Password Recovery Flow**:
   - Password reset request (`/auth/forgot-password`) with **anti-enumeration protection** (always reports generic success without leaking email existence)
   - Password reset callback and OTP / PKCE exchange (`/auth/confirm`)
   - Password update form (`/auth/update-password`)
3. **Route Protection & Redirections**:
   - Server-side authentication check on protected routes (`/protected`)
   - Edge proxy / middleware automatically redirects unauthenticated users to `/auth/login`
   - Authenticated users attempting to visit `/auth/login` or `/auth/sign-up` are automatically redirected to `/protected`
4. **User Profile Mapping**:
   - Pure profile extraction utility (`mapUserProfile`) extracting `displayName` (full_name, name, or first/last name with email fallback), system role, user ID, and timestamps
   - Displayed in the authenticated `/protected` dashboard
5. **Input Validation & Security**:
   - Strict dual-layer validation (Zod schemas on server actions + client-side form feedback)
   - Supabase Auth error mapping (`mapAuthError`) providing user-friendly error messages without revealing internal system details

### Supabase Dashboard Configuration

To enable email confirmations and password recovery flows in your Supabase project, configure the following settings in your [Supabase Dashboard](https://supabase.com/dashboard):

#### 1. URL Configuration (Authentication > URL Configuration)
- **Site URL**:
  - Development: `http://localhost:3000`
  - Production: `https://your-domain.com`
- **Redirect URLs** (Add all of the following):
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/confirm?next=/protected`
  - `http://localhost:3000/auth/confirm?type=recovery&next=/auth/update-password`
  - `http://localhost:3000/auth/update-password`
  - `http://localhost:3000/protected`
  - *(For production, replace `http://localhost:3000` with your production domain)*

#### 2. Email Templates (Authentication > Email Templates)
Ensure your Supabase project email templates use the correct confirmation link:
- **Confirm signup**:
  - Redirect link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/protected`
- **Reset Password**:
  - Redirect link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`

---

## Phase 2.3: Authorization, Security & Quality Gate

Phase 2.3 hardens application security by establishing a strict Role-Based Access Control (RBAC) model, database-backed user profiles, and Row Level Security (RLS).

### 1. Minimal Role Model

The application defines a minimal, explicit two-role authorization system:
- **`admin`**: System administrator with complete operational and administrative privileges.
- **`employee`**: Standard default user role assigned automatically to newly registered accounts.

### 2. Trusted Server-Controlled Profiles

- **Table**: `public.profiles` (`id`, `email`, `full_name`, `role`, `avatar_url`, `created_at`, `updated_at`).
- **Location**: `supabase/migrations/20261013000000_create_profiles_table.sql`.
- **Automatic Provisioning Trigger**: `handle_new_user()` executes on `auth.users` insert with `SECURITY DEFINER`, guaranteeing that new signups *always* default to role `'employee'`. User-supplied signup metadata cannot grant admin status.
- **Anti-Self-Promotion Trigger**: `prevent_role_self_promotion()` blocks any client from modifying the `role` column via `UPDATE`. Only `service_role` or authorized administrators can update roles.
- **Repository Isolation**: `ProfileRepository.updateProfile()` safely omits the `role` column, preventing client profile update payloads from escalating privileges.

### 3. Row Level Security (RLS) Policies

Row Level Security is enabled on `public.profiles` with least-privilege policies:
- `profiles_select_own`: Users can view their own profile (`auth.uid() = id`).
- `profiles_select_admin`: Administrators can query all profiles.
- `profiles_update_own`: Users can update non-privileged fields on their own profile (`auth.uid() = id`).
- `profiles_update_admin`: Administrators can update profiles.
- `profiles_service_role_all`: Server service-role possesses full unconstrained access.

### 4. Server-Enforced Admin Authorization

- **Server Guard (`AuthService.requireAdmin`)**: Enforces authentication and verifies `role === 'admin'` against the trusted database profile before rendering `/protected`.
- **403 Access Denied (`/unauthorized`)**: Authenticated non-admin users attempting to access the dashboard or admin resources are redirected to `/unauthorized` on the server.
- **Server Actions Guard (`assignUserRoleAction`)**: Verifies caller is an active administrator before permitting role updates.

### 5. Secure Initial Administrator Provisioning

To prevent unauthorized privilege escalation, there is **no public API or self-assignment endpoint** for the `admin` role. Initial administrator accounts must be provisioned through secure backend mechanisms:

#### Option A: Server-Side CLI Script (Recommended)
Infrastructure engineers can provision the initial admin directly on the server runtime:

```bash
# Provision by email
npx tsx scripts/provision-admin.ts admin@yourcompany.com
```

This script:
1. Validates `SUPABASE_SERVICE_ROLE_KEY` is present.
2. Locates the registered user in Supabase Auth.
3. Updates `public.profiles.role` to `'admin'`.
4. Synchronizes `auth.users.raw_app_meta_data.role` to `'admin'`.

#### Option B: Supabase Dashboard SQL Editor
Run the following SQL snippet directly in your Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'admin@yourcompany.com';
```

---

## Testing & Quality Assurance

| Command | Purpose |
|---|---|
| `npm test` | Runs all unit and smoke tests (deterministic, mock-driven, CI-ready). |
| `npm run test:watch` | Starts Vitest in interactive watch mode for local development. |
| `npm run test:coverage` | Generates V8 code coverage report in `./coverage`. |
| `npm run lint` | Runs ESLint across the codebase. |
| `npx tsc --noEmit` | Validates TypeScript strict type checking. |
| `npm run build` | Builds optimized production Next.js application. |