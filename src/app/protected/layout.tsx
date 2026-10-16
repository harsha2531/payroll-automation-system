import Link from "next/link";
import { Building2 } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AuthService } from "@/services/auth.service";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await AuthService.getCurrentUserWithProfile();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      {/* Header bar: authenticated user email with green admin badge */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <Link
              href="/protected"
              className="text-base font-semibold tracking-tight text-foreground hover:underline"
            >
              Payroll Automation System
            </Link>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AuthButton />
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main layout with left sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
