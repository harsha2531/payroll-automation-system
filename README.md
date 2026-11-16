# Payroll Automation System

A full-stack payroll application that imports employee payroll data from Excel, stores it in Supabase, generates individual PDF payslips, and emails them to employees through Brevo.

> **Status:** Deployed to Vercel for testing. Verify the production configuration before using real payroll data.

## Features

- Supabase Auth login and role-based administrator access.
- Import employee and payroll data from Excel workbooks.
- Store and review payroll records by year and month.
- Generate individual A4 PDF payslips using Playwright.
- Store PDFs in private Supabase Storage.
- Send employee-specific payslips using Brevo.
- Track processing results and support retries where implemented.

## Technology stack

| Area | Technology |
|---|---|
| Frontend | Next.js / React |
| Backend | Next.js API routes and server-side code |
| Language | TypeScript |
| Authentication | Supabase Auth |
| Database and storage | Supabase PostgreSQL / Storage |
| Excel processing | Server-side workbook parsing |
| PDF generation | Playwright |
| Email | Brevo |
| Testing | Vitest |
| Hosting and source control | Vercel / GitHub |

## How it works

1. An administrator signs in and uploads an Excel workbook.
2. The backend reads employee worksheets and maps payroll values.
3. Employee and payroll records are saved in Supabase.
4. The administrator selects a payroll year and month.
5. The backend retrieves the saved payroll records.
6. Individual payslip PDFs are generated and stored.
7. Each employee receives their own payslip through Brevo.
8. Processing results and failures are recorded.

**Monthly processing uses payroll data already saved in Supabase.** The workbook only needs to be uploaded when importing or updating payroll data.

## Important payroll rules

- Use the imported Gross Salary and Net Salary values.
- Preserve imported employee deductions and employer contributions.
- Do not independently recalculate EPF or ETF.
- Do not invent values when workbook fields are missing.
- Display the actual variable-pay label, such as Bonus or Overtime.
- Handle empty worksheets and changing Excel layouts safely.

## Getting started

### Prerequisites

- Node.js and npm compatible with the project.
- Git.
- A Supabase project.
- A Brevo account configured for transactional email.

### Install

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <PROJECT_DIRECTORY>
npm install
```

### Configure environment variables

Create `.env.local` in the project root. Confirm the exact variable names in the application source code.

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never commit environment files or expose service-role keys and Brevo API keys in browser-side code.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Use the scripts defined in `package.json` for testing and production builds. Common commands are:

```bash
npm run test
npm run build
npm run start
```

## Database migrations

Database schema changes should be tracked as SQL migrations. The project has previously used migration files for profiles and payroll; check the repository and remote migration history for the current state.

```bash
npx supabase login
npx supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>
npx supabase migration list
npx supabase db push
```

Create a new migration for changes to an already-applied schema. Review SQL before applying it to production.

## Deployment

The application uses GitHub for source control, Vercel for hosting, and Supabase for data services.

1. Push approved changes to the configured GitHub deployment branch.
2. Configure the required environment variables in Vercel.
3. Deploy the application.
4. Review build and runtime logs.
5. Test login, Excel import, monthly payroll retrieval, PDF generation, and email delivery.

## Security

Payroll records and payslips are confidential.

- Enforce administrator authorization on the server.
- Apply appropriate Supabase Row Level Security policies.
- Keep privileged credentials server-side.
- Use a private Storage bucket and secure access to payslips.
- Ensure each employee receives only their own payslip.
- Validate uploaded workbooks and sanitize filenames.
- Avoid logging credentials or sensitive payroll information.
- Prevent duplicate processing and email sends.

## Production checklist

Before using live payroll data, verify authorization, database policies, payslip privacy, email recipient isolation, backups, and processing reliability. Test the complete workflow with non-sensitive data first.
