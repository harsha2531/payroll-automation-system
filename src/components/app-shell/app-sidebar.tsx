import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Banknote,
  Users,
  FileSpreadsheet,
  Settings,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    disabled: false,
  },
  {
    title: "Payroll Processing",
    href: "#",
    icon: Banknote,
    disabled: true,
    badge: "Upcoming",
  },
  {
    title: "Employees",
    href: "#",
    icon: Users,
    disabled: true,
    badge: "Upcoming",
  },
  {
    title: "Reports & Pay Slips",
    href: "#",
    icon: FileSpreadsheet,
    disabled: true,
    badge: "Upcoming",
  },
  {
    title: "System Settings",
    href: "#",
    icon: Settings,
    disabled: true,
    badge: "Upcoming",
  },
];

export function AppSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4 transition-colors">
      <div className="mb-4 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Navigation Shell
      </div>
      <nav className="flex-1 space-y-1.5" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/60 cursor-not-allowed select-none bg-muted/20"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 opacity-50" />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-primary bg-accent/50 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span>{item.title}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border pt-4 px-2 text-xs text-muted-foreground">
        <p className="font-medium">Payroll Automation</p>
        <p className="text-[11px] text-muted-foreground/80">Architecture Foundation</p>
      </div>
    </aside>
  );
}
