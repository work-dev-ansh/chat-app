/**
 * Formats an ISO date string, timestamp, or Date object into a localized short time string (e.g., "10:32 AM").
 * Falls back gracefully to an empty string ("") if parsing fails, input is whitespace-only, or the date is invalid.
 */
export function formatMessageTime(
  dateInput: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  if (!dateInput) return "";

  if (typeof dateInput === "string" && !dateInput.trim()) {
    return "";
  }

  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], options);
  } catch {
    return "";
  }
}

