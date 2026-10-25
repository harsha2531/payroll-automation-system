import Link from "next/link";
import { Building2 } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { AuthService } from "@/services/auth.service";

export default async function EmployeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await AuthService.requireAdmin();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur transition-colors">
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNav isAdmin={isAdmin} />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <Link
              href="/protected"
              className="text-base font-semibold tracking-tight text-foreground hover:underline"
            >
              Payroll Automation System
            </Link>
            <p className="text-xs text-muted-foreground hidden sm:block">Admin Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <AuthButton />
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main layout with left sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar isAdmin={isAdmin} currentPath="/employees" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-background">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
