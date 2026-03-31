const AutoLaunch = require("auto-launch");
const { app } = require("electron");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let autoLauncher = null;

function setupAutoLaunch() {
  autoLauncher = new AutoLaunch({
    name: "Ascension",
    path: app.getPath("exe"),
    isHidden: true,
  });

  autoLauncher
    .isEnabled()
    .then((isEnabled) => {
      if (!isEnabled) {
        autoLauncher.enable();
        console.log("[Protection] Auto-launch enabled");
      } else {
        console.log("[Protection] Auto-launch already enabled");
      }
    })
    .catch((err) => {
      console.error("[Protection] Auto-launch setup failed:", err.message);
    });
}

// ─── Windows: Scheduled Task guardian ───────────────────────────────────────

function setupGuardianTaskWindows() {
  if (!app.isPackaged) return; // dev mode only - skip
  try {
    const execPath = app.getPath("exe");
    const taskName = "AscensionGuardian";
    const psCheck = `Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue`;
    const exists = execSync(`powershell -Command "${psCheck}"`, { stdio: "pipe" })
      .toString()
      .trim();
    if (exists) return; // already registered

    // PowerShell action: only launch if not already running
    const action = `if (-not (Get-Process -Name 'Ascension' -ErrorAction SilentlyContinue)) { Start-Process '${execPath.replace(/'/g, "''")}' }`;
    const ps = `
      $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-WindowStyle Hidden -Command "${action}"';
      $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 2);
      $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew;
      Register-ScheduledTask -TaskName '${taskName}' -Action $action -Trigger $trigger -Settings $settings -RunLevel Limited -Force
    `;
    execSync(`powershell -Command "${ps.replace(/\n\s+/g, " ")}"`, { stdio: "ignore" });
    console.log("[Protection] Guardian task registered (Windows Scheduled Task)");
  } catch (err) {
    console.error("[Protection] Guardian task setup failed:", err.message);
  }
}

// ─── macOS: LaunchAgent guardian ────────────────────────────────────────────

function setupGuardianTaskMac() {
  if (!app.isPackaged) return; // dev mode only - skip
  try {
    const execPath = app.getPath("exe");
    const agentLabel = "com.ascension.guardian";
    const agentDir = path.join(process.env.HOME || "", "Library", "LaunchAgents");
    const plistPath = path.join(agentDir, agentLabel + ".plist");

    // Already installed
    if (fs.existsSync(plistPath)) {
      console.log("[Protection] LaunchAgent already exists");
      return;
    }

    // Ensure LaunchAgents directory exists
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Create a shell script that checks if Ascension is running before launching
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${agentLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>pgrep -x "Ascension" > /dev/null || open "${execPath.replace(/"/g, '\\"')}"</string>
  </array>
  <key>StartInterval</key>
  <integer>120</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ascension-guardian.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ascension-guardian.log</string>
</dict>
</plist>`;

    fs.writeFileSync(plistPath, plistContent, "utf8");

    // Load the agent
    try {
      execSync(`launchctl load "${plistPath}"`, { stdio: "ignore" });
    } catch (_) {
      // May already be loaded or need user context
    }

    console.log("[Protection] Guardian task registered (macOS LaunchAgent)");
  } catch (err) {
    console.error("[Protection] Guardian task setup failed:", err.message);
  }
}

// ─── Platform dispatcher ────────────────────────────────────────────────────

function setupGuardianTask() {
  if (process.platform === "win32") {
    setupGuardianTaskWindows();
  } else if (process.platform === "darwin") {
    setupGuardianTaskMac();
  } else {
    console.log("[Protection] Guardian task not supported on " + process.platform);
  }
}

function setupProtection(mainWindow) {
  setupGuardianTask();
  console.log("[Protection] Uninstall protection active");
}

module.exports = { setupAutoLaunch, setupProtection };
