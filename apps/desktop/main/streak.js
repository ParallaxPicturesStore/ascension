/**
 * Streak module — reads use anon key (RLS), writes use Edge Function.
 */

const { getDb, getAuthDb, callEdgeFunction, getAccessToken } = require("./api-client");

async function getStreak(userId) {
  const db = getDb();
  if (!db) return null;

  const { data, error } = await db
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[Streak] Error fetching:", error.message);
    return null;
  }
  return data;
}

async function resetStreak(userId) {
  const token = getAccessToken();
  if (!token) {
    console.error("[Streak] No access token — cannot reset streak");
    return false;
  }

  try {
    await callEdgeFunction("streaks.reset", { user_id: userId }, token);
    console.log(`[Streak] Reset for user ${userId}`);
    return true;
  } catch (err) {
    console.error("[Streak] Error resetting:", err.message);
    return false;
  }
}

async function incrementStreak(userId) {
  const token = getAccessToken();
  if (!token) {
    console.error("[Streak] No access token — cannot increment streak");
    return false;
  }

  try {
    await callEdgeFunction("streaks.increment", { user_id: userId }, token);
    return true;
  } catch (err) {
    console.error("[Streak] Error incrementing:", err.message);
    return false;
  }
}

// Run daily at midnight to increment streaks for all active users
let dailyTimer = null;

function startDailyStreakUpdate() {
  // Calculate ms until next midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    await updateAllStreaks();
    // Then every 24 hours
    dailyTimer = setInterval(updateAllStreaks, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`[Streak] Daily update scheduled - next run in ${Math.round(msUntilMidnight / 60000)} minutes`);
}

async function updateAllStreaks() {
  console.log("[Streak] Running daily streak update");

  const db = getDb();
  if (!db) return;

  // Get all users who haven't relapsed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: streaks, error } = await db
    .from("streaks")
    .select("user_id, current_streak, longest_streak, last_relapse_date");

  if (error || !streaks) {
    console.error("[Streak] Error fetching streaks:", error?.message);
    return;
  }

  for (const streak of streaks) {
    // Only increment if last relapse was before today
    const lastRelapse = streak.last_relapse_date ? new Date(streak.last_relapse_date) : null;
    if (!lastRelapse || lastRelapse < today) {
      await incrementStreak(streak.user_id);
    }
  }

  console.log(`[Streak] Updated ${streaks.length} streaks`);
}

async function getWeeklyStats(userId) {
  const db = getAuthDb() || getDb();
  if (!db) return { screenshotCount: 0, blockedCount: 0, flaggedCount: 0 };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [screenshots, blocked, alerts] = await Promise.all([
    db
      .from("screenshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("timestamp", weekAgo.toISOString()),
    db
      .from("blocked_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("timestamp", weekAgo.toISOString()),
    db
      .from("screenshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("flagged", true)
      .gte("timestamp", weekAgo.toISOString()),
  ]);

  if (screenshots.error || blocked.error || alerts.error) {
    console.error("[Streak] Error fetching weekly stats:", {
      screenshots: screenshots.error?.message,
      blocked: blocked.error?.message,
      alerts: alerts.error?.message,
    });
  }

  return {
    screenshotCount: screenshots.count || 0,
    blockedCount: blocked.count || 0,
    flaggedCount: alerts.count || 0,
  };
}

module.exports = {
  getStreak,
  resetStreak,
  incrementStreak,
  startDailyStreakUpdate,
  getWeeklyStats,
};
