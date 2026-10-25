import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Banknote,
  Users,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
  adminOnly?: boolean;
}

const baseNavItems: NavItem[] = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    disabled: false,
  },
  {
    title: "Payroll Processing",
    href: "/payroll",
    icon: Banknote,
    disabled: false,
    badge: "Planned",
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
    disabled: false,
  },
  {
    title: "Payslips",
    href: "/payslips",
    icon: FileText,
    disabled: false,
    badge: "Planned",
  },
];

const adminPortalNavItems: NavItem[] = [
  {
    title: "Admin Dashboard",
    href: "/protected",
    icon: LayoutDashboard,
    disabled: false,
    adminOnly: true,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
    disabled: false,
  },
  {
    title: "Import Excel",
    href: "/payroll/import",
    icon: FileSpreadsheet,
    disabled: false,
    badge: "Planned",
  },
  {
    title: "Monthly Payroll",
    href: "/payroll",
    icon: Banknote,
    disabled: false,
    badge: "Planned",
  },
  {
    title: "Payslips",
    href: "/payslips",
    icon: FileText,
    disabled: false,
    badge: "Planned",
  },
];

export interface AppSidebarProps {
  isAdmin?: boolean;
  currentPath?: string;
}

export function AppSidebar({ isAdmin = false, currentPath }: AppSidebarProps = {}) {
  const itemsToRender = isAdmin ? adminPortalNavItems : baseNavItems;

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4 transition-colors">
      <div className="mb-4 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Navigation
      </div>
      <nav className="flex-1 space-y-1.5" aria-label="Main Navigation">
        {itemsToRender.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath ? currentPath === item.href : false;

          if (item.disabled) {
            return (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/60 cursor-not-allowed select-none bg-muted/20"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 opacity-50" />
                  <span>
                    {item.adminOnly && <span className="sr-only">Admin </span>}
                    {item.title}
                  </span>
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
              className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-foreground/80 hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  {item.adminOnly && <span className="sr-only">Admin </span>}
                  {item.title}
                </span>
              </div>
              {item.badge && (
                <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border pt-4 px-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Payroll Automation</p>
        <p className="text-[11px] text-muted-foreground/80">Enterprise Portal</p>
      </div>
    </aside>
  );
}

