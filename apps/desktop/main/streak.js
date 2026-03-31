const { createClient } = require("@supabase/supabase-js");

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }
  return supabase;
}

async function getStreak(userId) {
  const { data, error } = await getSupabase()
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
  const now = new Date().toISOString();

  const { data: current } = await getSupabase()
    .from("streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .single();

  const { error } = await getSupabase()
    .from("streaks")
    .update({
      current_streak: 0,
      last_relapse_date: now,
      longest_streak: Math.max(current?.longest_streak || 0, current?.current_streak || 0),
      updated_at: now,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[Streak] Error resetting:", error.message);
    return false;
  }

  console.log(`[Streak] Reset for user ${userId} - previous: ${current?.current_streak} days`);
  return true;
}

async function incrementStreak(userId) {
  const { data: current } = await getSupabase()
    .from("streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .single();

  if (!current) return false;

  const newStreak = current.current_streak + 1;
  const { error } = await getSupabase()
    .from("streaks")
    .update({
      current_streak: newStreak,
      longest_streak: Math.max(current.longest_streak, newStreak),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[Streak] Error incrementing:", error.message);
    return false;
  }

  return true;
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

  // Get all users who haven't relapsed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: streaks, error } = await getSupabase()
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
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [screenshots, blocked, alerts] = await Promise.all([
    getSupabase()
      .from("screenshots")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .gte("timestamp", weekAgo.toISOString()),
    getSupabase()
      .from("blocked_attempts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .gte("timestamp", weekAgo.toISOString()),
    getSupabase()
      .from("screenshots")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("flagged", true)
      .gte("timestamp", weekAgo.toISOString()),
  ]);

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
