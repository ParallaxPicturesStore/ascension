const { app, BrowserWindow, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Crash logging - robust file-based logging with timestamps
const logFile = path.join(app.getPath("userData"), "crash.log");
function crashLog(msg) {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}
process.on("uncaughtException", (err) => {
  crashLog("UNCAUGHT EXCEPTION: " + (err ? err.stack || err.message || String(err) : "unknown"));
});
process.on("unhandledRejection", (reason) => {
  crashLog("UNHANDLED REJECTION: " + (reason && reason.stack ? reason.stack : String(reason)));
});
crashLog("=== App starting (pid: " + process.pid + ", platform: " + process.platform + ", packaged: " + (app.isPackaged ? "yes" : "no") + ") ===");

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
const { getAccessToken } = require("./api-client");

let mainWindow = null;
let watchdogProcess = null;
let currentUserId = null;
let allowQuit = false;
const isDev = !app.isPackaged;

// Resolve the static export directory (Next.js out/)
function getOutDir() {
  const candidates = [
    path.join(__dirname, "../out"),
    path.join(app.getAppPath(), "out"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      crashLog("Found out dir: " + candidate);
      return candidate;
    }
  }
  crashLog("WARNING: No out dir found");
  return candidates[0];
}

// Start a simple local HTTP server to serve the Next.js static export
// This avoids file:// routing issues where /login becomes C:/login
let localServerPort = 0;
function startLocalServer() {
  return new Promise((resolve) => {
    const http = require("http");
    const outDir = getOutDir();

    const server = http.createServer((req, res) => {
      let urlPath = req.url.split("?")[0];
      if (urlPath === "/") urlPath = "/index.html";

      // Try exact file, then .html, then /index.html
      const tryPaths = [
        path.join(outDir, urlPath),
        path.join(outDir, urlPath + ".html"),
        path.join(outDir, urlPath, "index.html"),
      ];

      let filePath = null;
      for (const candidate of tryPaths) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          filePath = candidate;
          break;
        }
      }

      // Fallback to index.html for client-side routing
      if (!filePath) {
        filePath = path.join(outDir, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
        ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
        ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff",
        ".woff2": "font/woff2", ".txt": "text/plain",
      };

      try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      localServerPort = server.address().port;
      crashLog("Local server started on port " + localServerPort);
      resolve(localServerPort);
    });
  });
}

function getProductionUrl() {
  return `http://127.0.0.1:${localServerPort}/`;
}

function createWindow() {
  crashLog("Creating BrowserWindow...");

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
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: true,
    },
  });

  let url;
  if (isDev && !localServerPort) {
    url = "http://localhost:3001";
  } else {
    url = getProductionUrl();
  }
  crashLog("Loading URL: " + url + " (isDev=" + isDev + ", port=" + localServerPort + ")");

  // Fallback: if ready-to-show never fires (e.g. page load fails), show window after 5s
  const showFallbackTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      crashLog("Fallback: showing window after 5s timeout (ready-to-show never fired)");
      mainWindow.show();
    }
  }, 5000);

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // SECURITY: Prevent navigation to untrusted origins
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const allowed = ["http://localhost:3001", "http://127.0.0.1:", "file://", "app://"];
    if (!allowed.some((a) => navigationUrl.startsWith(a))) {
      event.preventDefault();
      console.warn("[Security] Blocked navigation to:", navigationUrl);
    }
  });

  // SECURITY: Prevent new window creation (e.g. window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require("electron");
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        shell.openExternal(url);
      }
    } catch (_) {}
    return { action: "deny" };
  });

  // Handle page load failures (wrong path, missing file, etc.)
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    crashLog("did-fail-load: code=" + errorCode + " desc=" + errorDescription + " url=" + validatedURL);
    console.error("[Main] Page failed to load:", errorDescription, validatedURL);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    crashLog("Page loaded successfully");
  });

  mainWindow.on("close", (e) => {
    if (!allowQuit) {
      e.preventDefault();
      mainWindow.hide();
      mainWindow.webContents.send("app-hidden");
    }
  });

  mainWindow.on("ready-to-show", () => {
    clearTimeout(showFallbackTimer);
    crashLog("ready-to-show fired, showing window");
    mainWindow.show();
  });

  return mainWindow;
}

function spawnWatchdog(userId) {
  if (watchdogProcess) return;
  currentUserId = userId;
  const watchdogPath = path.join(__dirname, "watchdog.js");
  const execPath = app.getPath("exe");
  const token = getAccessToken() || "";
  watchdogProcess = spawn(process.execPath, [watchdogPath, userId, process.pid, execPath, token], {
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
    const { getDb } = require("./api-client");
    const db = getDb();
    if (!db) return;
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
  crashLog("app.whenReady() fired");

  // Always start local server if out/ directory exists (handles both packaged and unpackaged)
  const outDir = getOutDir();
  if (fs.existsSync(path.join(outDir, "index.html"))) {
    crashLog("Starting local server (out dir found at: " + outDir + ")");
    await startLocalServer();
  } else {
    crashLog("No out/index.html found, using dev server");
  }

  Menu.setApplicationMenu(null);
  crashLog("Step 1/7: Creating window...");
  mainWindow = createWindow();

  crashLog("Step 2/7: Creating tray...");
  createTray(mainWindow, confirmQuit);

  crashLog("Step 3/7: Registering IPC handlers...");
  registerIpcHandlers(mainWindow, onUserLoggedIn, doAuthorizedQuit);

  crashLog("Step 4/7: Setting up auto-launch...");
  setupAutoLaunch();

  crashLog("Step 5/7: Starting capture engine...");
  startCapture(mainWindow);

  crashLog("Step 6/7: Setting up protection...");
  setupProtection(mainWindow);

  crashLog("Step 7/7: Starting daily streak update...");
  startDailyStreakUpdate();

  // Hosts-file URL blocking — silent if elevation is denied
  setupBlocking().catch((err) => {
    crashLog("Blocker setup failed: " + err.message);
    console.error("[Main] Blocker setup failed:", err.message);
  });

  crashLog("=== Startup complete ===");
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
