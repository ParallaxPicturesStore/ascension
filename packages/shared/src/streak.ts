/**
 * Pure streak calculation helpers.
 * No side effects, no database calls - just math.
 */

/**
 * Calculate the current streak in days from the last relapse date.
 * If there is no relapse date, returns the existing currentStreak value.
 */
export function calculateStreak(
  lastRelapseDate: string | null,
  currentStreak: number
): number {
  if (!lastRelapseDate) return currentStreak;

  const relapse = new Date(lastRelapseDate);
  const now = new Date();

  // Zero out time components for day-level comparison
  relapse.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - relapse.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Determine whether the streak should be incremented based on last update.
 * Returns true if at least 24 hours have elapsed since lastUpdateDate.
 */
export function shouldIncrementStreak(lastUpdateDate: string | null): boolean {
  if (!lastUpdateDate) return true;

  const last = new Date(lastUpdateDate);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  return diffMs >= oneDayMs;
}

/**
 * Format a streak number for display.
 * Examples: "0 days", "1 day", "42 days"
 */
export function formatStreakDisplay(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}
