const { desktopCapturer } = require("electron");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { getDb, callEdgeFunction, getAccessToken } = require("./api-client");
const { analyzeImage } = require("./rekognition");
const { analyzeLocally } = require("./local-analyzer");
const { isRekognitionEnabled } = require("./subscription");
const { resetStreak } = require("./streak");

const CAPTURE_INTERVAL_MS = 60 * 1000;
const FLAG_THRESHOLD = 70;
const ALERT_THRESHOLD = 90;

let captureTimer = null;
let captureState = "active";
let mainWindowRef = null;
let currentUserId = null;

const tempDir = path.join(os.tmpdir(), "ascension-captures");

function ensureTempDir() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

async function captureScreen() {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (sources.length > 0) {
    return sources[0].thumbnail.toPNG();
  }
  return null;
}

async function blurScreenshot(buffer) {
  return sharp(buffer).blur(40).jpeg({ quality: 30 }).toBuffer();
}

// Get the current user's info for alert context (anon key — RLS allows own row)
async function getCurrentUser() {
  const db = getDb();
  if (!db || !currentUserId) return null;

  const { data } = await db
    .from("users")
    .select("id, name, email, partner_email, partner_id")
    .eq("id", currentUserId)
    .single();

  return data;
}

async function captureAndAnalyze() {
  if (captureState !== "active") return;

  try {
    const imgBuffer = await captureScreen();
    if (!imgBuffer) {
      console.log("[Capture] No screen source available");
      return null;
    }

    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();

    console.log(`[Capture] Screenshot taken at ${timestamp}`);

    // Local analysis first (free, on-device) — only call Rekognition if suspicious
    const localResult = await analyzeLocally(imgBuffer);
    let analysis;
    if (localResult !== null && !localResult.needsVerification) {
      // Locally confirmed clean — skip Rekognition entirely
      console.log(`[Capture] Local clean (${localResult.localScore}%) — skipping Rekognition`);
      analysis = { labels: [], maxConfidence: 0, raw: [] };
    } else if (isRekognitionEnabled()) {
      // Local flagged or model unavailable — verify with Rekognition (within grace period)
      analysis = await analyzeImage(imgBuffer);
    } else {
      // Grace period expired — fall back to local score only
      if (localResult) {
        console.log(`[Capture] Rekognition offline (grace period ended) — using local score ${localResult.localScore}%`);
        analysis = {
          labels: localResult.localScore >= 60 ? [`Explicit content detected (local: ${localResult.localScore}%)`] : [],
          maxConfidence: localResult.localScore,
          raw: [],
        };
      } else {
        analysis = { labels: [], maxConfidence: 0, raw: [] };
      }
    }
    const maxConfidence = analysis.maxConfidence || 0;
    const flagged = maxConfidence >= FLAG_THRESHOLD;
    const immediateAlert = maxConfidence >= ALERT_THRESHOLD;

    const user = await getCurrentUser();
    const token = getAccessToken();

    // Log screenshot to Supabase via Edge Function
    if (user && token) {
      await callEdgeFunction("screenshots.log", {
        user_id: user.id,
        timestamp,
        rekognition_score: maxConfidence,
        flagged,
        labels: analysis.labels,
      }, token).catch((err) => console.error("[Capture] Failed to log screenshot:", err.message));
    }

    if (flagged) {
      console.log(
        `[Capture] FLAGGED - Confidence: ${maxConfidence}% - Labels: ${analysis.labels.join(", ")}`
      );

      const blurredBuffer = await blurScreenshot(imgBuffer);
      ensureTempDir();
      const blurredPath = path.join(tempDir, `${id}-blurred.jpg`);
      fs.writeFileSync(blurredPath, blurredBuffer);

      // Reset streak
      if (user) {
        await resetStreak(user.id);
        console.log(`[Capture] Streak reset for ${user.name}`);
      }

      // Create alert in Supabase via Edge Function
      if (user && user.partner_id && token) {
        await callEdgeFunction("alerts.create", {
          user_id: user.id,
          partner_id: user.partner_id,
          type: "content_detected",
          message: `Explicit content detected with ${maxConfidence.toFixed(0)}% confidence. Labels: ${analysis.labels.join(", ")}`,
        }, token).catch((err) => console.error("[Capture] Failed to create alert:", err.message));
      }

      // Send email to partner via Edge Function
      if (user?.partner_email && token) {
        await callEdgeFunction("alerts.sendEmail", {
          type: "content_detected",
          to: user.partner_email,
          userName: user.name,
          data: {
            confidence: maxConfidence.toFixed(0),
            labels: analysis.labels.join(", "),
          },
        }, token).catch((err) => console.error("[Capture] Failed to send alert email:", err.message));
      }

      // Notify renderer
      if (mainWindowRef) {
        mainWindowRef.webContents.send("capture:event", {
          type: immediateAlert ? "immediate_alert" : "flagged",
          id,
          timestamp,
          confidence: maxConfidence,
          labels: analysis.labels,
          blurredPath,
        });
      }
    } else {
      console.log(`[Capture] Clean - Confidence: ${maxConfidence}%`);

      if (mainWindowRef) {
        mainWindowRef.webContents.send("capture:event", {
          type: "clean",
          id,
          timestamp,
          confidence: maxConfidence,
        });
      }
    }

    return { id, timestamp, flagged, confidence: maxConfidence, labels: analysis.labels };
  } catch (err) {
    console.error("[Capture] Error:", err.message);
    return null;
  }
}

function setCurrentUserId(userId) {
  currentUserId = userId;
}

function startCapture(mainWindow) {
  if (mainWindow) mainWindowRef = mainWindow;
  captureState = "active";

  setTimeout(() => captureAndAnalyze(), 5000);
  captureTimer = setInterval(() => captureAndAnalyze(), CAPTURE_INTERVAL_MS);

  console.log("[Capture] Engine started - capturing every 60s");
}

function stopCapture() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  captureState = "stopped";
  console.log("[Capture] Engine stopped");
}

async function pauseCapture() {
  captureState = "paused";
  console.log("[Capture] Engine paused - sending evasion alert");

  try {
    // Send evasion alert via Edge Function
    const user = await getCurrentUser();
    const token = getAccessToken();

    if (user && user.partner_id && token) {
      await callEdgeFunction("alerts.create", {
        user_id: user.id,
        partner_id: user.partner_id,
        type: "evasion",
        message: "Monitoring was paused by the user.",
      }, token);
    }

    if (user?.partner_email && token) {
      await callEdgeFunction("alerts.sendEmail", {
        type: "evasion",
        to: user.partner_email,
        userName: user.name,
        data: { action: "paused" },
      }, token);
    }
  } catch (err) {
    console.error("[Capture] Failed to send pause evasion alert:", err.message);
  }

  if (mainWindowRef) {
    mainWindowRef.webContents.send("capture:event", {
      type: "paused",
      timestamp: new Date().toISOString(),
    });
  }
}

function resumeCapture() {
  captureState = "active";
  console.log("[Capture] Engine resumed");

  if (mainWindowRef) {
    mainWindowRef.webContents.send("capture:event", {
      type: "resumed",
      timestamp: new Date().toISOString(),
    });
  }
}

function getCaptureState() {
  return captureState;
}

module.exports = {
  startCapture,
  stopCapture,
  pauseCapture,
  resumeCapture,
  getCaptureState,
  setCurrentUserId,
};
