/**
 * Display name utilities.
 * Pure functions — no external dependencies, safe in all environments.
 */

/**
 * Format a display name from a first name and last name.
 *
 * Rules:
 * - Trims leading/trailing whitespace from each part.
 * - If both parts are non-empty after trimming, joins them with a single space.
 * - If only one part is non-empty, returns that part alone.
 * - If both parts are empty or whitespace-only, returns an empty string.
 *
 * @param firstName - The person's first name.
 * @param lastName  - The person's last name (family name).
 * @returns A cleanly formatted full display name string.
 *
 * @example
 * formatDisplayName("Alice", "Smith")    // → "Alice Smith"
 * formatDisplayName("Alice", "")         // → "Alice"
 * formatDisplayName("", "Smith")         // → "Smith"
 * formatDisplayName("  ", "  ")          // → ""
 * formatDisplayName("Alice", undefined)  // → "Alice"
 */
export function formatDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();

  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return "";
}
