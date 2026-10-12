import { describe, it, expect } from "vitest";
import { formatDisplayName } from "@/lib/display-name";

describe("formatDisplayName", () => {
  // --- Normal input ---
  it("combines a first name and last name with a single space", () => {
    expect(formatDisplayName("Alice", "Smith")).toBe("Alice Smith");
  });

  it("is case-preserving (does not alter casing)", () => {
    expect(formatDisplayName("JOHN", "DOE")).toBe("JOHN DOE");
    expect(formatDisplayName("mary", "jane")).toBe("mary jane");
  });

  it("handles multi-word first or last names as a single argument", () => {
    expect(formatDisplayName("Alice Marie", "van der Berg")).toBe(
      "Alice Marie van der Berg"
    );
  });

  // --- Empty input ---
  it("returns only the first name when last name is empty string", () => {
    expect(formatDisplayName("Alice", "")).toBe("Alice");
  });

  it("returns only the last name when first name is empty string", () => {
    expect(formatDisplayName("", "Smith")).toBe("Smith");
  });

  it("returns empty string when both parts are empty strings", () => {
    expect(formatDisplayName("", "")).toBe("");
  });

  // --- Null / undefined input ---
  it("returns the last name when first name is null", () => {
    expect(formatDisplayName(null, "Smith")).toBe("Smith");
  });

  it("returns the first name when last name is undefined", () => {
    expect(formatDisplayName("Alice", undefined)).toBe("Alice");
  });

  it("returns empty string when both parts are null", () => {
    expect(formatDisplayName(null, null)).toBe("");
  });

  it("returns empty string when both parts are undefined", () => {
    expect(formatDisplayName(undefined, undefined)).toBe("");
  });

  // --- Whitespace input ---
  it("trims leading and trailing whitespace from each part", () => {
    expect(formatDisplayName("  Alice  ", "  Smith  ")).toBe("Alice Smith");
  });

  it("returns empty string when both parts are whitespace-only", () => {
    expect(formatDisplayName("   ", "   ")).toBe("");
  });

  it("returns only the non-whitespace name when one part is whitespace-only", () => {
    expect(formatDisplayName("  ", "Smith")).toBe("Smith");
    expect(formatDisplayName("Alice", "   ")).toBe("Alice");
  });

  // --- Edge cases ---
  it("handles single-character names", () => {
    expect(formatDisplayName("A", "B")).toBe("A B");
  });

  it("handles names with internal whitespace unchanged", () => {
    // Internal spaces within the argument are preserved
    expect(formatDisplayName("Anne Marie", "de Silva")).toBe("Anne Marie de Silva");
  });

  it("returns empty string when both parts are an empty string after trim", () => {
    expect(formatDisplayName("\t", "\n")).toBe("");
  });
});
