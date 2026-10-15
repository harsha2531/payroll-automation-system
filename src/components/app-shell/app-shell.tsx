import React from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export interface AppShellProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

export function AppShell({ children, isAdmin }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
