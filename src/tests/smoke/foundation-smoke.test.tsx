import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";

// Mock next/navigation redirect before importing Home
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
import { redirect } from "next/navigation"; // mocked
import Home from "@/app/page";

describe("Application Foundation Smoke Tests", () => {
  it("renders AppHeader with application title", () => {
    render(<AppHeader />);
    expect(screen.getByRole("heading", { name: /payroll automation system/i })).toBeInTheDocument();
    expect(screen.getByText(/foundation active/i)).toBeInTheDocument();
  });

  it("renders AppSidebar with navigation items", () => {
    render(<AppSidebar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText(/overview/i)).toBeInTheDocument();
    expect(screen.getByText(/payroll processing/i)).toBeInTheDocument();
  });

  it("redirects Home page to login for unauthenticated users", () => {
    render(<Home />);
    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });
});
