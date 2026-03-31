const AutoLaunch = require("auto-launch");
const { app } = require("electron");
const { execSync } = require("child_process");

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

function setupGuardianTask() {
  if (!app.isPackaged) return; // dev mode only — skip
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
    console.log("[Protection] Guardian task registered");
  } catch (err) {
    console.error("[Protection] Guardian task setup failed:", err.message);
  }
}

function setupProtection(mainWindow) {
  setupGuardianTask();
  console.log("[Protection] Uninstall protection active");
}

module.exports = { setupAutoLaunch, setupProtection };
