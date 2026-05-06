-- ============================================================
-- Migration: Fix stale longest_streak values
-- Date: 2026-04-30
-- Any row where longest_streak < current_streak is invalid.
-- This corrects all existing bad rows in one pass.
-- ============================================================

UPDATE public.streaks
SET
  longest_streak = current_streak,
  updated_at = NOW()
WHERE longest_streak < current_streak;
