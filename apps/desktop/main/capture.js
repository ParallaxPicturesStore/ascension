const { desktopCapturer } = require("electron");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createClient } = require("@supabase/supabase-js");
const { analyzeImage } = require("./rekognition");
const { analyzeLocally } = require("./local-analyzer");
const { isRekognitionEnabled } = require("./subscription");
const { sendAlertEmail } = require("./alerts");
const { resetStreak } = require("./streak");

const CAPTURE_INTERVAL_MS = 60 * 1000;
const FLAG_THRESHOLD = 70;
const ALERT_THRESHOLD = 90;

let captureTimer = null;
let captureState = "active";
let mainWindowRef = null;
let supabase = null;
let currentUserId = null;

const tempDir = path.join(os.tmpdir(), "ascension-captures");

function getSupabase() {
  if (!supabase && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return supabase;
}

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

// Get the current user's info for alert context
async function getCurrentUser() {
  const db = getSupabase();
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

    const db = getSupabase();
    const user = await getCurrentUser();

    // Log screenshot to Supabase
    if (db && user) {
      await db.from("screenshots").insert({
        user_id: user.id,
        timestamp,
        rekognition_score: maxConfidence,
        flagged,
        labels: analysis.labels,
      });
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

      // Create alert in Supabase
      if (db && user && user.partner_id) {
        await db.from("alerts").insert({
          user_id: user.id,
          partner_id: user.partner_id,
          type: "content_detected",
          message: `Explicit content detected with ${maxConfidence.toFixed(0)}% confidence. Labels: ${analysis.labels.join(", ")}`,
        });
      }

      // Send email to partner
      if (user?.partner_email) {
        await sendAlertEmail("content_detected", user.partner_email, user.name, {
          confidence: maxConfidence.toFixed(0),
          labels: analysis.labels.join(", "),
        });
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
    // Send evasion alert
    const user = await getCurrentUser();
    const db = getSupabase();

    if (db && user && user.partner_id) {
      await db.from("alerts").insert({
        user_id: user.id,
        partner_id: user.partner_id,
        type: "evasion",
        message: "Monitoring was paused by the user.",
      });
    }

    if (user?.partner_email) {
      await sendAlertEmail("evasion", user.partner_email, user.name, {
        action: "paused",
      });
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
