"use client";

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakCounter({
  currentStreak,
  longestStreak,
}: StreakCounterProps) {
  return (
    <div className="text-center py-8">
      <div className="text-7xl font-bold text-foreground tabular-nums">
        {currentStreak}
      </div>
      <div className="text-muted text-sm mt-1 uppercase tracking-wider">
        {currentStreak === 1 ? "day clean" : "days clean"}
      </div>
      <div className="mt-4 text-xs text-muted">
        Longest streak: <span className="text-accent font-semibold">{longestStreak} days</span>
      </div>
    </div>
  );
}
