import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("Shared Utility: formatCurrency", () => {
  it("formats positive numbers into Sri Lankan Rupees (LKR) by default", () => {
    expect(formatCurrency(1234.56)).toBe(
      new Intl.NumberFormat("en-SL", {
        style: "currency",
        currency: "LKR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234.56)
    );
  });

  it("handles zero correctly", () => {
    expect(formatCurrency(0)).toBe(
      new Intl.NumberFormat("en-SL", {
        style: "currency",
        currency: "LKR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(0)
    );
  });

  it("handles non-finite numbers gracefully", () => {
    const zeroFormatted = new Intl.NumberFormat("en-SL", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
    expect(formatCurrency(NaN)).toBe(zeroFormatted);
    expect(formatCurrency(Infinity)).toBe(zeroFormatted);
  });

  it("supports custom currency and locale", () => {
    expect(formatCurrency(1234.56, "USD", "en-US")).toBe("$1,234.56");
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
