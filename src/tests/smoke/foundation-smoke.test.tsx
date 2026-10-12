import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "@/app/page";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";

describe("Application Foundation Smoke Tests", () => {
  it("renders AppHeader with application title", () => {
    render(<AppHeader />);
    expect(
      screen.getByRole("heading", { name: /payroll automation system/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/foundation active/i)).toBeInTheDocument();
  });

  it("renders AppSidebar with navigation items", () => {
    render(<AppSidebar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText(/overview/i)).toBeInTheDocument();
    expect(screen.getByText(/payroll processing/i)).toBeInTheDocument();
  });

  it("renders Home page foundation overview", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /application foundation initialized/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/app router & ts/i)).toBeInTheDocument();
  });
});
