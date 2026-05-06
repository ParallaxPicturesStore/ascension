/**
 * Pure streak calculation helpers.
 * No side effects, no database calls - just math.
 */

// ── Internal helpers ────────────────────────────────────────

function daysSinceAnchor(anchor: Date, now: Date): number {
  const anchorMidnight = new Date(anchor);
  anchorMidnight.setHours(0, 0, 0, 0);

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);

  const diffMs = nowMidnight.getTime() - anchorMidnight.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Public API ──────────────────────────────────────────────

export interface StreakFields {
  /** Set at account creation; reset to now() on each relapse. */
  streakStartedAt?: string | null;
  /** Timestamp of the last relapse, if any. */
  lastRelapseDate?: string | null;
  /** Last time the streak row was updated — used as a last-resort fallback. */
  updatedAt?: string | null;
  /** Stored streak value — used only when all timestamp fields are null. */
  currentStreak?: number | null;
}

/**
 * Calculate the current streak from raw Supabase streak row fields.
 *
 * Priority of anchor selection:
 *   1. last_relapse_date  — most recent reset event
 *   2. streak_started_at  — initial start of the clean streak
 *   3. updated_at         — last-resort fallback for legacy rows
 *   4. currentStreak      — stored number, used only when no dates are available
 *
 * The stored current_streak column is intentionally ignored when any
 * timestamp anchor is present because the daily increment job can drift.
 */
export function calculateStreak(fields: StreakFields, now?: Date): number;

/**
 * Legacy two-argument form: calculateStreak(lastRelapseDate, currentStreak).
 * Used by the existing shared test suite and any callers that haven't migrated.
 *
 * - When lastRelapseDate is provided: returns days since that date.
 * - When lastRelapseDate is null: returns currentStreak (stored value).
 */
export function calculateStreak(lastRelapseDate: string | null, currentStreak?: number): number;

export function calculateStreak(
  fieldsOrLastRelapseDate: unknown,
  currentStreakOrNow?: number | Date,
): number {
  // Distinguish between object-form and legacy two-arg form.
  if (typeof fieldsOrLastRelapseDate === 'object' && fieldsOrLastRelapseDate !== null && !('toISOString' in (fieldsOrLastRelapseDate as object))) {
    // Object / StreakFields form
    const fields = fieldsOrLastRelapseDate as StreakFields;
    const now = (currentStreakOrNow instanceof Date ? currentStreakOrNow : undefined) ?? new Date();

    const anchor =
      parseDate(fields.lastRelapseDate) ??
      parseDate(fields.streakStartedAt) ??
      parseDate(fields.updatedAt);

    if (anchor) {
      return daysSinceAnchor(anchor, now);
    }

    return Math.max(0, fields.currentStreak ?? 0);
  }

  // Legacy two-arg form: (lastRelapseDate: string | null, currentStreak?: number)
  const lastRelapseDate = fieldsOrLastRelapseDate as string | null;
  const storedStreak = typeof currentStreakOrNow === 'number' ? currentStreakOrNow : 0;
  const now = new Date();

  const anchor = parseDate(lastRelapseDate);
  if (anchor) {
    return daysSinceAnchor(anchor, now);
  }

  return Math.max(0, storedStreak);
}

/**
 * Returns true if the streak row hasn't been updated in the last 24 hours,
 * meaning it's safe to increment the streak for a new day.
 */
export function shouldIncrementStreak(lastUpdatedAt: string | null, now = new Date()): boolean {
  const updatedAt = parseDate(lastUpdatedAt);
  if (!updatedAt) return true;

  const diffMs = now.getTime() - updatedAt.getTime();
  return diffMs >= 24 * 60 * 60 * 1000;
}

/**
 * Format a streak number for display.
 * Examples: "0 days", "1 day", "42 days"
 */
export function formatStreakDisplay(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}
