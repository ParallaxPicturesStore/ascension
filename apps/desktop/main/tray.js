const { Tray, Menu, nativeImage, app, dialog } = require("electron");
const path = require("path");
const { pauseCapture, resumeCapture, getCaptureState } = require("./capture");

let tray = null;

function createTray(mainWindow, onQuit) {
  // Create a simple 16x16 tray icon (placeholder - replace with real icon)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  // Generate a simple colored icon programmatically
  const canvas = nativeImage.createFromBuffer(
    Buffer.from(
      // 16x16 PNG with a simple shield shape (placeholder)
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAA" +
        "Q0lEQVQ4y2NgoBAw0sIAJlwSjAwMDIyMDAwMf/8zMPz5w8Dw9x8DAwMjIwOYjWQAXgOY" +
        "GBgYGJiYGBiYmOhrAAMA5JQHEU8DArcAAAAASUVORK5CYII=",
      "base64"
    )
  );

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Ascension - Active");

  function buildMenu() {
    const isPaused = getCaptureState() === "paused";

    return Menu.buildFromTemplate([
      {
        label: "Ascension",
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Open Dashboard",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: "separator" },
      {
        label: isPaused ? "Resume Monitoring" : "Pause Monitoring",
        click: () => {
          if (isPaused) {
            resumeCapture();
            tray.setToolTip("Ascension - Active");
          } else {
            pauseCapture();
            tray.setToolTip("Ascension - Paused");
          }
          tray.setContextMenu(buildMenu());
        },
      },
      { type: "separator" },
      {
        label: "Quit Ascension",
        click: async () => {
          if (onQuit) {
            await onQuit("tray quit");
          } else {
            app.quit();
          }
        },
      },
    ]);
  }

  tray.setContextMenu(buildMenu());

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

module.exports = { createTray };
