"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Banknote,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  isAdmin?: boolean;
}

export function MobileNav({ isAdmin = false }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = isAdmin
    ? [
        { title: "Dashboard", href: "/protected", icon: LayoutDashboard },
        { title: "Employees", href: "/employees", icon: Users },
        { title: "Import Excel", href: "/payroll/import", icon: FileSpreadsheet },
        { title: "Monthly Payroll", href: "/payroll", icon: Banknote },
        { title: "Payslips", href: "/payslips", icon: FileText },
      ]
    : [
        { title: "Overview", href: "/", icon: LayoutDashboard },
        { title: "Employees", href: "/employees", icon: Users },
        { title: "Monthly Payroll", href: "/payroll", icon: Banknote },
        { title: "Payslips", href: "/payslips", icon: FileText },
      ];

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Navigation Menu"
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <div className="fixed inset-x-0 top-16 z-50 border-b border-border bg-background p-4 shadow-lg animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
