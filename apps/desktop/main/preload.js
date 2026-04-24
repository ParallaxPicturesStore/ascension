const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ascension", {
  // Capture control
  pauseCapture: () => ipcRenderer.invoke("capture:pause"),
  resumeCapture: () => ipcRenderer.invoke("capture:resume"),
  getCaptureStatus: () => ipcRenderer.invoke("capture:status"),

  // App control
  showWindow: () => ipcRenderer.invoke("app:show"),
  hideWindow: () => ipcRenderer.invoke("app:hide"),
  quitApp: (partnerPassword) => ipcRenderer.invoke("app:quit", partnerPassword),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  setQuitPassword: (userId, password) =>
    ipcRenderer.invoke("user:set-quit-password", { userId, password }),

  // Alerts
  sendAlert: (type, partnerEmail, userName, data) =>
    ipcRenderer.invoke("alert:send", { type, partnerEmail, userName, data }),
  invitePartner: (partnerEmail, userName, authContext) =>
    ipcRenderer.invoke("alert:invite-partner", {
      partnerEmail,
      userName,
      ...(authContext || {}),
    }),

  // Streak
  getStreak: (userId) => ipcRenderer.invoke("streak:get", userId),
  resetStreak: (userId) => ipcRenderer.invoke("streak:reset", userId),
  getWeeklyStats: (userId) => ipcRenderer.invoke("streak:weekly-stats", userId),

  // Billing
  openCheckout: (userId, userEmail, plan) =>
    ipcRenderer.invoke("billing:checkout", { userId, userEmail, plan }),
  getSubscriptionStatus: (userId) => ipcRenderer.invoke("billing:status", userId),
  openBillingPortal: (customerId) => ipcRenderer.invoke("billing:portal", customerId),

  // Screenshot data
  getRecentScreenshots: () => ipcRenderer.invoke("screenshots:recent"),
  getScreenshotStats: () => ipcRenderer.invoke("screenshots:stats"),

  // Notify main process of login (starts watchdog) — pass access token for Edge Function calls
  notifyLoggedIn: (userId, accessToken, supabaseUrl, supabaseAnonKey) =>
    ipcRenderer.invoke("user:logged-in", userId, accessToken, supabaseUrl, supabaseAnonKey),

  // Send updated access token (e.g. after token refresh)
  updateToken: (accessToken) => ipcRenderer.invoke("user:update-token", accessToken),

  // Shell
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),

  // Events from main process
  onCaptureEvent: (callback) => {
    ipcRenderer.on("capture:event", (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("capture:event");
  },
  onAppHidden: (callback) => {
    ipcRenderer.on("app-hidden", () => callback());
    return () => ipcRenderer.removeAllListeners("app-hidden");
  },
  onSubscriptionLocked: (callback) => {
    ipcRenderer.on("subscription:locked", () => callback());
    return () => ipcRenderer.removeAllListeners("subscription:locked");
  },
});
