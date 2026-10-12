import React from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Payroll Automation System
          </h1>
          <p className="text-xs text-muted-foreground">Application Foundation v0.1.0</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Foundation Active</span>
        </div>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
