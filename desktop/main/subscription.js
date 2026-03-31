/**
 * Subscription lapse management
 * - Checks subscription status on login and every 12 hours
 * - Grace period: Rekognition stays active for 30 days after lapse
 * - Sends reminder emails to user + partner at day 1, 7, 14, 30
 * - Remote kill switch: app_disabled flag in Supabase locks the UI
 */

const { createClient } = require("@supabase/supabase-js");
const { sendAlertEmail } = require("./alerts");

const REKOGNITION_GRACE_DAYS = 30;

// In-memory state (updated on each check)
let rekognitionEnabled = true;
let appDisabled = false;
let checkInterval = null;
let currentUserId = null;
let currentMainWindow = null;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Return reminder keys that are due but not yet sent
function dueReminders(days, alreadySent) {
  const schedule = [
    { key: "day1",  minDays: 1  },
    { key: "day7",  minDays: 7  },
    { key: "day14", minDays: 14 },
    { key: "day30", minDays: 30 },
  ];
  return schedule
    .filter((r) => days >= r.minDays && !alreadySent.includes(r.key))
    .map((r) => r.key);
}

async function sendLapseReminders(user, dueKeys) {
  const db = getSupabase();
  const alreadySent = Array.isArray(user.lapse_reminders_sent) ? user.lapse_reminders_sent : [];
  const newSent = [...alreadySent];

  for (const key of dueKeys) {
    await sendAlertEmail("subscription_lapse", user.email, user.name || "there", { key });

    if (user.partner_email) {
      await sendAlertEmail(
        "subscription_lapse_partner",
        user.partner_email,
        user.name || "your partner",
        { key }
      );
    }

    newSent.push(key);
    console.log(`[Subscription] Lapse reminder '${key}' sent for user ${user.id}`);
  }

  await db
    .from("users")
    .update({ lapse_reminders_sent: newSent })
    .eq("id", user.id);
}

async function checkSubscription() {
  if (!currentUserId) return;

  try {
    const db = getSupabase();
    const { data: user } = await db
      .from("users")
      .select(
        "id, name, email, partner_email, subscription_status, subscription_lapse_date, app_disabled, lapse_reminders_sent"
      )
      .eq("id", currentUserId)
      .single();

    if (!user) return;

    // --- Remote kill switch ---
    appDisabled = !!user.app_disabled;
    if (appDisabled && currentMainWindow) {
      currentMainWindow.webContents.send("subscription:locked");
      console.log("[Subscription] Remote kill switch active — locking UI");
    }

    const isLapsed =
      user.subscription_status === "cancelled" ||
      user.subscription_status === "expired";

    if (isLapsed) {
      // Record lapse start date if not already set
      let lapseDate = user.subscription_lapse_date;
      if (!lapseDate) {
        lapseDate = new Date().toISOString();
        await db
          .from("users")
          .update({ subscription_lapse_date: lapseDate })
          .eq("id", user.id);
        console.log(`[Subscription] Lapse date recorded for user ${user.id}`);
      }

      const days = daysSince(lapseDate);
      rekognitionEnabled = days < REKOGNITION_GRACE_DAYS;

      console.log(
        `[Subscription] Lapsed ${days} day(s). Rekognition: ${
          rekognitionEnabled ? `ON (${REKOGNITION_GRACE_DAYS - days}d grace remaining)` : "OFF"
        }`
      );

      // Send any overdue reminders
      const alreadySent = Array.isArray(user.lapse_reminders_sent)
        ? user.lapse_reminders_sent
        : [];
      const due = dueReminders(days, alreadySent);
      if (due.length > 0) {
        await sendLapseReminders(user, due);
      }
    } else {
      // Active subscription
      rekognitionEnabled = true;

      // Clear lapse data if they've resubscribed after a lapse
      if (user.subscription_lapse_date) {
        await db
          .from("users")
          .update({ subscription_lapse_date: null, lapse_reminders_sent: [] })
          .eq("id", user.id);
        console.log(`[Subscription] User ${user.id} resubscribed — lapse data cleared`);
      }
    }
  } catch (err) {
    console.error("[Subscription] Check failed:", err.message);
  }
}

async function initSubscriptionCheck(userId, mainWindow) {
  currentUserId = userId;
  currentMainWindow = mainWindow;

  // Immediate check on login
  await checkSubscription();

  // Periodic check every 12 hours
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkSubscription(), 12 * 60 * 60 * 1000);
}

function isRekognitionEnabled() {
  return rekognitionEnabled;
}

function isAppDisabled() {
  return appDisabled;
}

module.exports = { initSubscriptionCheck, isRekognitionEnabled, isAppDisabled };
