/**
 * Dates as the Thype design prints them: "May 7, 2019".
 *
 * Separate from `formatDate` in `lib/utils.ts`, which the admin uses in British
 * order. Formatted in UTC so a server's local zone cannot move a story to the
 * neighbouring day between builds; publication times are stored in UTC.
 */
const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPublicDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : DATE.format(date);
}

/** "Monday, May 6, 2019" — the top bar. */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date);
}
