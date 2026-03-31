const { ipcMain, app, shell } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const { pauseCapture, resumeCapture, getCaptureState } = require("./capture");
const { sendAlertEmail } = require("./alerts");
const { getStreak, resetStreak, getWeeklyStats } = require("./streak");
const { createCheckoutSession, getSubscriptionStatus, createCustomerPortalSession } = require("./billing");
const { hashQuitPassword } = require("./crypto-utils");

let currentUserId = null;

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

function registerIpcHandlers(mainWindow, onUserLoggedIn, doAuthorizedQuit) {
  // Capture control
  ipcMain.handle("capture:pause", () => {
    pauseCapture();
    return { status: "paused" };
  });

  ipcMain.handle("capture:resume", () => {
    resumeCapture();
    return { status: "active" };
  });

  ipcMain.handle("capture:status", () => {
    return { status: getCaptureState() };
  });

  // App control
  ipcMain.handle("app:show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle("app:hide", () => {
    mainWindow.hide();
  });

  ipcMain.handle("app:quit", async (_, password) => {
    console.log("[IPC] Quit requested");

    if (!currentUserId) {
      if (doAuthorizedQuit) await doAuthorizedQuit("closed app (no session)");
      return { success: true };
    }

    const { data: user } = await getDb()
      .from("users")
      .select("name, partner_password_hash")
      .eq("id", currentUserId)
      .single();

    // No quit password set yet — allow but send evasion alert
    if (!user?.partner_password_hash) {
      if (doAuthorizedQuit) await doAuthorizedQuit("closed the app");
      return { success: true };
    }

    const hash = hashQuitPassword(password || "", currentUserId);
    if (hash !== user.partner_password_hash) {
      return { success: false, error: "Incorrect password" };
    }

    if (doAuthorizedQuit) await doAuthorizedQuit("closed the app (authorized)");
    return { success: true };
  });

  ipcMain.handle("app:info", () => {
    return {
      version: app.getVersion(),
      captureState: getCaptureState(),
      platform: process.platform,
    };
  });

  // Alert emails
  ipcMain.handle("alert:send", async (_, { type, partnerEmail, userName, data }) => {
    return await sendAlertEmail(type, partnerEmail, userName, data);
  });

  ipcMain.handle("alert:invite-partner", async (_, { partnerEmail, userName }) => {
    return await sendAlertEmail("partner_invitation", partnerEmail, userName, {
      signupUrl: "https://getascension.app/signup",
    });
  });

  // Streak
  ipcMain.handle("streak:get", async (_, userId) => {
    return await getStreak(userId);
  });

  ipcMain.handle("streak:reset", async (_, userId) => {
    return await resetStreak(userId);
  });

  ipcMain.handle("streak:weekly-stats", async (_, userId) => {
    return await getWeeklyStats(userId);
  });

  // Billing
  ipcMain.handle("billing:checkout", async (_, { userId, userEmail, plan }) => {
    const session = await createCheckoutSession(userId, userEmail, plan);
    if (session?.url) {
      shell.openExternal(session.url);
      return { success: true, url: session.url };
    }
    return { success: false };
  });

  ipcMain.handle("billing:status", async (_, userId) => {
    return await getSubscriptionStatus(userId);
  });

  ipcMain.handle("billing:portal", async (_, customerId) => {
    const session = await createCustomerPortalSession(customerId);
    if (session?.url) {
      shell.openExternal(session.url);
      return { success: true };
    }
    return { success: false };
  });

  // Screenshot data
  ipcMain.handle("screenshots:recent", async () => {
    if (!currentUserId) return [];
    const { data } = await getDb()
      .from("screenshots")
      .select("id, timestamp, flagged, rekognition_score, labels, file_path")
      .eq("user_id", currentUserId)
      .order("timestamp", { ascending: false })
      .limit(20);
    return data || [];
  });

  ipcMain.handle("screenshots:stats", async () => {
    if (!currentUserId) return { totalCaptures: 0, flaggedCount: 0, lastCaptureTime: null };
    const [total, flagged] = await Promise.all([
      getDb()
        .from("screenshots")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId),
      getDb()
        .from("screenshots")
        .select("timestamp")
        .eq("user_id", currentUserId)
        .eq("flagged", true)
        .order("timestamp", { ascending: false })
        .limit(1),
    ]);
    return {
      totalCaptures: total.count || 0,
      flaggedCount: flagged.data?.length || 0,
      lastCaptureTime: flagged.data?.[0]?.timestamp || null,
    };
  });

  // Notify main process that user has logged in - starts watchdog
  ipcMain.handle("user:logged-in", (_, userId) => {
    currentUserId = userId;
    if (onUserLoggedIn) onUserLoggedIn(userId);
    return { ok: true };
  });

  // Set the quit password (hashed and stored in Supabase)
  ipcMain.handle("user:set-quit-password", async (_, { userId, password }) => {
    if (!password || password.length < 4) {
      return { success: false, error: "Password must be at least 4 characters" };
    }
    const hash = hashQuitPassword(password, userId);
    const { error } = await getDb()
      .from("users")
      .update({ partner_password_hash: hash })
      .eq("id", userId);
    return { success: !error, error: error?.message };
  });

  // Open external URL
  ipcMain.handle("shell:open-external", (_, url) => {
    shell.openExternal(url);
  });

  console.log("[IPC] Handlers registered");
}

module.exports = { registerIpcHandlers };
