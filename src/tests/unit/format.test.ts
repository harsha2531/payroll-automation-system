import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("Shared Utility: formatCurrency", () => {
  it("formats positive numbers into USD currency string", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("handles zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles non-finite numbers gracefully", () => {
    expect(formatCurrency(NaN)).toBe("$0.00");
    expect(formatCurrency(Infinity)).toBe("$0.00");
  });
});

describe("Shared Utility: formatDate", () => {
  it("formats a Date object to YYYY-MM-DD", () => {
    const date = new Date("2026-10-12T00:00:00.000Z");
    expect(formatDate(date)).toBe("2026-10-12");
  });

  it("formats an ISO string to YYYY-MM-DD", () => {
    expect(formatDate("2026-05-15T14:30:00.000Z")).toBe("2026-05-15");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("invalid-date")).toBe("");
  });
});
