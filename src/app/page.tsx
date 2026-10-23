import React from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { CheckCircle2, Code2, Server, Shield } from "lucide-react";
import { AuthRedirect } from "@/components/auth-redirect";

export default function Home() {
  return (
    <AppShell>
      <AuthRedirect />
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Application Foundation Initialized
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Payroll Automation system architecture ready for feature expansion.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-card-foreground">App Router & TS</h3>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Configured Next.js App Router with strict TypeScript checking and modular app shell structure.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-card-foreground">Tailwind Styling</h3>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Tailwind CSS tokens, responsive layout grid, and light/dark theme support enabled.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-500/10 p-2 text-blue-500">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-card-foreground">Testing Setup</h3>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Vitest and React Testing Library setup for foundation smoke testing.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Server className="h-4 w-4 text-primary" />
            <span>Architecture Status</span>
          </div>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-medium text-foreground">Next.js 16 (App Router)</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
              <span className="text-muted-foreground">Type System</span>
              <span className="font-medium text-foreground">TypeScript (Strict)</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
              <span className="text-muted-foreground">Styling Engine</span>
              <span className="font-medium text-foreground">Tailwind CSS</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
              <span className="text-muted-foreground">Testing Runner</span>
              <span className="font-medium text-foreground">Vitest + RTL</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

