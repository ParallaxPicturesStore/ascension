const { app, BrowserWindow, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Crash logging
const logFile = path.join(app.getPath("userData"), "crash.log");
function crashLog(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + " " + msg + "\n"); } catch (_) {}
}
process.on("uncaughtException", (err) => {
  crashLog("UNCAUGHT: " + err.stack);
});
process.on("unhandledRejection", (err) => {
  crashLog("UNHANDLED: " + (err && err.stack ? err.stack : String(err)));
});
crashLog("App starting...");

// Load env vars from .env.local in dev
try {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx);
          const val = trimmed.substring(eqIdx + 1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
} catch (_) {}

const { createTray } = require("./tray");
const { startCapture, setCurrentUserId } = require("./capture");
const { registerIpcHandlers } = require("./ipc");
const { setupAutoLaunch, setupProtection } = require("./protection");
const { startDailyStreakUpdate } = require("./streak");
const { sendAlertEmail } = require("./alerts");
const { setupBlocking } = require("./blocker");
const { initSubscriptionCheck } = require("./subscription");

let mainWindow = null;
let watchdogProcess = null;
let currentUserId = null;
let allowQuit = false;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    show: false,
    resizable: false,
    title: "Ascension",
    backgroundColor: "#faf9f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? "http://localhost:3001"
    : `file://${path.join(__dirname, "../out/index.html")}`;

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("close", (e) => {
    if (!allowQuit) {
      e.preventDefault();
      mainWindow.hide();
      mainWindow.webContents.send("app-hidden");
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  return mainWindow;
}

function spawnWatchdog(userId) {
  if (watchdogProcess) return;
  currentUserId = userId;
  const watchdogPath = path.join(__dirname, "watchdog.js");
  const execPath = app.getPath("exe");
  watchdogProcess = spawn(process.execPath, [watchdogPath, userId, process.pid, execPath], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  watchdogProcess.unref();
  console.log("[Watchdog] Spawned for user " + userId + " (pid: " + watchdogProcess.pid + ")");
}

// Called by ipc.js after password verification — the only clean quit path
async function doAuthorizedQuit(evasionAction) {
  allowQuit = true;
  await sendEvasionAlert(evasionAction);
  app.quit();
}

// Called by tray or before-quit — no password check, shows dialog, sends alert
async function confirmQuit(reason) {
  if (!mainWindow) { allowQuit = true; app.quit(); return; }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Quit Ascension",
    message: "Your accountability partner will be notified.",
    detail: "To close Ascension properly, use Quit in Settings and enter your quit password.",
    buttons: ["Cancel", "Force Quit (sends alert)"],
    defaultId: 0,
    cancelId: 0,
  });
  if (response === 1) {
    await doAuthorizedQuit(reason || "force quit");
  }
}

async function sendEvasionAlert(action) {
  if (!currentUserId) return;
  try {
    const { createClient } = require("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    const { data: user } = await db
      .from("users")
      .select("name, partner_email")
      .eq("id", currentUserId)
      .single();
    if (user && user.partner_email) {
      await sendAlertEmail("evasion", user.partner_email, user.name || "Your partner", { action });
      console.log("[Main] Evasion alert sent to " + user.partner_email);
    }
  } catch (err) {
    console.error("[Main] Failed to send evasion alert:", err.message);
  }
}

function onUserLoggedIn(userId) {
  currentUserId = userId;
  setCurrentUserId(userId);
  spawnWatchdog(userId);
  // Check subscription status, grace period, and remote kill switch
  initSubscriptionCheck(userId, mainWindow).catch((err) => {
    console.error("[Main] Subscription check failed:", err.message);
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  mainWindow = createWindow();
  createTray(mainWindow, confirmQuit);
  registerIpcHandlers(mainWindow, onUserLoggedIn, doAuthorizedQuit);
  setupAutoLaunch();
  startCapture(mainWindow);
  setupProtection(mainWindow);
  startDailyStreakUpdate();

  // Hosts-file URL blocking — silent if elevation is denied
  setupBlocking().catch((err) => {
    console.error("[Main] Blocker setup failed:", err.message);
  });

  console.log("[Ascension] App started successfully");
});

app.on("window-all-closed", () => {});

app.on("before-quit", (e) => {
  if (!allowQuit) {
    e.preventDefault();
    confirmQuit("force quit");
  }
});

module.exports = { getMainWindow: () => mainWindow, onUserLoggedIn };
