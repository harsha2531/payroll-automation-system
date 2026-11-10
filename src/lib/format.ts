/**
 * Shared formatting utilities.
 * Can be safely imported in both Client and Server environments.
 */

/**
 * Format a numeric amount into a localized currency string.
 * Defaults to Sri Lankan Rupees (LKR, en-SL) if not specified.
 */
export function formatCurrency(
  amount: number,
  currency: string = "LKR", 
  locale: string = "en-SL"
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Format a Date or ISO string into a standardized date string (YYYY-MM-DD).
 */
export function formatDate(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().split("T")[0];
}
