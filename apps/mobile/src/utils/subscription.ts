/**
 * Returns true when a subscription lapse date is in the past.
 *
 * For date-only strings (YYYY-MM-DD), the date is treated as valid
 * until the end of that day in UTC to avoid expiring users early.
 */
export function isSubscriptionExpired(lapseDate: string | null): boolean {
  if (!lapseDate) return false;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(lapseDate);
  const parsed = isDateOnly
    ? new Date(`${lapseDate}T23:59:59.999Z`)
    : new Date(lapseDate);

  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() > parsed.getTime();
}