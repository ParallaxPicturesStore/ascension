const { ipcMain, app, shell } = require("electron");
const { getDb, callEdgeFunction, setAccessToken, getAccessToken, setSupabaseConfig } = require("./api-client");
const { pauseCapture, resumeCapture, getCaptureState, stopCapture, clearCurrentUser } = require("./capture");
const { sendAlertEmail } = require("./alerts");
const { getStreak, resetStreak, getWeeklyStats } = require("./streak");
const {
  createCheckoutSession,
  getSubscriptionStatus,
  createCustomerPortalSession,
} = require("./billing");
const { hashQuitPassword } = require("./crypto-utils");

let currentUserId = null;

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

  // Alert emails — validate inputs to prevent injection into email HTML
  ipcMain.handle(
    "alert:send",
    async (_, { type, partnerEmail, userName, data }) => {
      if (
        typeof type !== "string" ||
        typeof partnerEmail !== "string" ||
        typeof userName !== "string"
      ) {
        return { error: "Invalid alert parameters" };
      }
      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)) {
        return { error: "Invalid email address" };
      }
      return await sendAlertEmail(type, partnerEmail, userName, data);
    },
  );

  ipcMain.handle("alert:invite-partner", async (_, {
    partnerEmail,
    userName,
    inviterUserId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  }) => {
    if (typeof partnerEmail !== "string" || typeof userName !== "string") {
      return { error: "Invalid invitation parameters" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)) {
      return { error: "Invalid email address" };
    }
    if (typeof supabaseUrl === "string" && supabaseUrl.length > 0) {
      setSupabaseConfig(supabaseUrl, typeof supabaseAnonKey === "string" ? supabaseAnonKey : "");
    }
    if (typeof accessToken === "string" && accessToken.length > 0) {
      setAccessToken(accessToken);
    }
    return await sendAlertEmail("partner_invitation", partnerEmail, userName, {
      signupUrl: "https://getascension.app/signup",
      inviteCode: typeof inviterUserId === "string" ? inviterUserId : "",
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

  // Screenshot data (reads via anon key — RLS allows own data)
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
    if (!currentUserId)
      return { totalCaptures: 0, flaggedCount: 0, lastCaptureTime: null };
    const db = getDb();
    const [total, flaggedCount, lastCapture] = await Promise.all([
      db
        .from("screenshots")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId),
      db
        .from("screenshots")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .eq("flagged", true),
      db
        .from("screenshots")
        .select("timestamp")
        .eq("user_id", currentUserId)
        .order("timestamp", { ascending: false })
        .limit(1),
    ]);
    return {
      totalCaptures: total.count || 0,
      flaggedCount: flaggedCount.count || 0,
      lastCaptureTime: lastCapture.data?.[0]?.timestamp || null,
    };
  });

  // Notify main process that user has logged in - starts watchdog
  // Also receives the access token for Edge Function calls
  ipcMain.handle(
    "user:logged-in",
    (_, userId, accessToken, supabaseUrl, supabaseAnonKey) => {
      console.log(
        `[IPC] Received login - UserID: ${userId}, HasToken: ${!!accessToken}`,
      );
      // Validate userId is a UUID to prevent injection
      if (
        typeof userId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        )
      ) {
        console.warn("[IPC] Invalid userId rejected");
        return { ok: false, error: "Invalid user ID" };
      }
      currentUserId = userId;
      // Store Supabase config sent from the renderer (always available there via Next.js build)
      if (supabaseUrl) {
        setSupabaseConfig(supabaseUrl, supabaseAnonKey || "");
      }
      // Store the access token for all Edge Function calls
      if (accessToken) {
        setAccessToken(accessToken);
      }
      if (onUserLoggedIn) onUserLoggedIn(userId);
      return { ok: true };
    },
  );

  // Notify main process that user has logged out — stop capture and clear user state
  ipcMain.handle("user:logged-out", () => {
    console.log("[IPC] User logged out — stopping capture");
    currentUserId = null;
    clearCurrentUser();
    stopCapture();
    return { ok: true };
  });

  // Receive updated access token (e.g. after refresh)
  ipcMain.handle("user:update-token", (_, accessToken) => {
    if (typeof accessToken === "string") {
      setAccessToken(accessToken || null);
      return { ok: true };
    }
    return { ok: false, error: "Invalid token" };
  });

  // Link the current user to a partner account via Edge Function
  ipcMain.handle("user:link-partner", async (_, { userId, partnerEmail }) => {
    if (
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return { success: false, error: "Invalid user ID" };
    }
    if (
      typeof partnerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)
    ) {
      return { success: false, error: "Invalid partner email" };
    }
    if (userId !== currentUserId) {
      return { success: false, error: "Cannot link partner for another user" };
    }

    const token = getAccessToken();
    if (!token) {
      return { success: false, error: "No access token" };
    }

    try {
      const result = await callEdgeFunction(
        "users.linkPartner",
        {
          user_id: userId,
          partner_email: partnerEmail.trim().toLowerCase(),
        },
        token,
      );
      return { success: true, partnerId: result.partner_id || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Set the quit password (hashed and stored via Edge Function)
  ipcMain.handle("user:set-quit-password", async (_, { userId, password }) => {
    if (typeof password !== "string" || password.length < 4) {
      return {
        success: false,
        error: "Password must be at least 4 characters",
      };
    }
    // Validate userId is a UUID
    if (
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return { success: false, error: "Invalid user ID" };
    }
    // Only allow setting password for the currently logged-in user
    if (userId !== currentUserId) {
      return { success: false, error: "Cannot set password for another user" };
    }
    const hash = hashQuitPassword(password, userId);
    const token = getAccessToken();
    if (!token) {
      return { success: false, error: "No access token" };
    }
    try {
      await callEdgeFunction(
        "user.setQuitPassword",
        {
          user_id: userId,
          password_hash: hash,
        },
        token,
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Open external URL — only allow http(s) to prevent arbitrary protocol execution
  ipcMain.handle("shell:open-external", (_, url) => {
    if (typeof url !== "string") return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
      } else {
        console.warn("[IPC] Blocked non-http URL:", parsed.protocol);
      }
    } catch (e) {
      console.warn("[IPC] Invalid URL rejected:", url);
    }
  });

  console.log("[IPC] Handlers registered");
}

module.exports = { registerIpcHandlers };
