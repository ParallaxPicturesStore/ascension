/**
 * Ascension Watchdog Service
 *
 * Runs as a separate child process, independent of the main Electron app.
 * Sends a heartbeat to Supabase every 2 minutes while the app is running.
 * If the heartbeat stops (app killed, crashed, uninstalled), Supabase
 * detects the lapse and triggers a partner alert via a scheduled function.
 *
 * The watchdog is spawned by the main process and deliberately kept simple
 * so it can't easily be killed alongside the main process.
 */

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");

// Load env from .env.local
function loadEnv() {
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
}

loadEnv();

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        ""
    );
  }
  return supabase;
}

async function sendHeartbeat(userId) {
  try {
    await getSupabase()
      .from("users")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("id", userId);
    process.stdout.write(`[Watchdog] Heartbeat sent for ${userId}\n`);
  } catch (err) {
    process.stderr.write(`[Watchdog] Heartbeat failed: ${err.message}\n`);
  }
}

// Args: userId, mainPid, execPath
const userId = process.argv[2];
const mainPid = parseInt(process.argv[3]) || null;
const execPath = process.argv[4] || null;

if (!userId) {
  process.stderr.write("[Watchdog] No userId provided - exiting\n");
  process.exit(1);
}

process.stdout.write(`[Watchdog] Started for user ${userId} (watching PID ${mainPid})\n`);

// Send heartbeat immediately then on interval
sendHeartbeat(userId);
setInterval(() => sendHeartbeat(userId), HEARTBEAT_INTERVAL_MS);

// Monitor main process - if it dies and we're in production, relaunch it
const { spawn } = require("child_process");

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function isPackagedApp() {
  if (!execPath) return false;
  // Windows: path ends with .exe
  if (execPath.endsWith(".exe")) return true;
  // macOS: path contains .app bundle
  if (execPath.includes(".app/")) return true;
  // Linux: path is in /usr, /opt, or AppImage
  if (execPath.startsWith("/usr/") || execPath.startsWith("/opt/") || execPath.includes("AppImage")) return true;
  return false;
}

function relaunchApp() {
  if (!isPackagedApp()) return; // dev mode - don't relaunch
  process.stdout.write("[Watchdog] Main process gone - relaunching...\n");
  try {
    if (process.platform === "darwin") {
      // On macOS, use 'open' to launch the .app bundle properly
      const appBundlePath = execPath.split(".app/")[0] + ".app";
      spawn("open", [appBundlePath], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn(execPath, [], { detached: true, stdio: "ignore" }).unref();
    }
  } catch (err) {
    process.stderr.write(`[Watchdog] Relaunch failed: ${err.message}\n`);
  }
}

let relaunching = false;

setInterval(() => {
  if (mainPid && !isProcessAlive(mainPid) && !relaunching) {
    relaunching = true;
    relaunchApp();
    // Stop watching — the new process will spawn a fresh watchdog
    setTimeout(() => process.exit(0), 3000);
  }
}, 5000);

// Ignore termination signals
process.on("SIGTERM", () => {
  process.stdout.write("[Watchdog] Received SIGTERM - staying alive\n");
});

process.on("SIGINT", () => {
  process.stdout.write("[Watchdog] Received SIGINT - staying alive\n");
});
