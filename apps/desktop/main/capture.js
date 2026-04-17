const { desktopCapturer } = require("electron");
const screenshot = require("screenshot-desktop");
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
let cachedUser = null;
let waitingForUserLogged = false;

const tempDir = path.join(os.tmpdir(), "ascension-captures");

function ensureTempDir() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

function formatError(err) {
  if (err instanceof Error) return err.stack || err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources.length > 0 && !sources[0].thumbnail.isEmpty()) {
      return sources[0].thumbnail.toPNG();
    }
    console.warn(
      "[Capture] desktopCapturer returned no usable screen source - falling back",
    );
  } catch (err) {
    console.warn(
      `[Capture] desktopCapturer failed - falling back to screenshot-desktop: ${formatError(err)}`,
    );
  }

  try {
    return await screenshot({ format: "png" });
  } catch (err) {
    console.error(
      `[Capture] screenshot-desktop fallback failed: ${formatError(err)}`,
    );
    throw err;
  }
}

async function blurScreenshot(buffer) {
  return sharp(buffer).blur(40).jpeg({ quality: 30 }).toBuffer();
}

async function uploadScreenshotToStorage(userId, timestamp, buffer) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = getAccessToken();
  if (!supabaseUrl || !token) {
    console.warn("[Capture] Skipping storage upload - missing Supabase URL or access token");
    return null;
  }

  const storagePath = `screenshots/${userId}/${new Date(timestamp).getTime()}.jpg`;
  const storageUrl = `${supabaseUrl}/storage/v1/object/${storagePath}`;
  console.log("[Capture] Uploading screenshot to storage:", storagePath);

  try {
    const res = await fetch(storageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: buffer,
    });

    if (res.ok) {
      console.log("[Capture] Screenshot uploaded to storage:", storagePath);
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
      console.log("[Capture] Screenshot public URL:", publicUrl);
      return publicUrl;
    } else {
      console.warn("[Capture] Storage upload returned", res.status);
      return null;
    }
  } catch (err) {
    console.warn("[Capture] Failed to upload screenshot to storage:", err.message);
    return null;
  }
}

// Get the current user's info for alert context (anon key — RLS allows own row)
async function getCurrentUser() {
  if (currentUserCache) return currentUserCache;

  // Use getAuthDb() to bypass RLS for our own record
  const db = getAuthDb() || getDb();
  const hasToken = !!getAccessToken();

  console.log(`[Capture] getCurrentUser - ID: ${currentUserId}, AuthDB: ${!!getAuthDb()}, HasToken: ${hasToken}`);

  if (!db || !currentUserId) {
    console.log("[Capture] Aborting getCurrentUser: DB or ID missing"); return null;
  }
  const { data,error } = await db
    .from("users")
    .select("id, name, email, partner_email, partner_id")
    .eq("id", currentUserId)
    .single();

   if (error) {
    console.error("[Capture] Failed to fetch current user:", error.message);
    return null;
  }
if(data)currentUserCache = data;
  return data;
}

async function captureAndAnalyze() {
  if (captureState !== "active") return;
  if (!currentUserId) {
    console.log("[Capture] Skipping — no user logged in");
    return;
  }

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

    // Upload every capture (blurred) so storage is complete for both clean and flagged events.
    let screenshotUrl = null;
    let blurredBuffer = null;
    if (user) {
      blurredBuffer = await blurScreenshot(imgBuffer);
      screenshotUrl = await uploadScreenshotToStorage(user.id, timestamp, blurredBuffer);
      if (screenshotUrl) {
        console.log(`[Capture] Upload success for capture ${id}`);
      } else {
        console.warn(`[Capture] Upload failed for capture ${id}`);
      }
    } else {
      if (!currentUserId) {
        if (!waitingForUserLogged) {
          console.log("[Capture] Waiting for authenticated user before uploading captures");
          waitingForUserLogged = true;
        }
      } else {
        console.warn(`[Capture] Skipping upload for capture ${id} - no current user profile`);
      }
    }

    if (flagged) {
      console.log(
        `[Capture] FLAGGED - Confidence: ${maxConfidence}% - Labels: ${analysis.labels.join(", ")}`
      );

      if (!blurredBuffer) {
        blurredBuffer = await blurScreenshot(imgBuffer);
      }
      ensureTempDir();
      const blurredPath = path.join(tempDir, `${id}-blurred.jpg`);
      fs.writeFileSync(blurredPath, blurredBuffer);

      // Log screenshot with URL
      if (user && token) {
        await callEdgeFunction("screenshots.log", {
          user_id: user.id,
          timestamp,
          rekognition_score: maxConfidence,
          flagged: true,
          labels: analysis.labels,
          ...(screenshotUrl && { screenshot_url: screenshotUrl }),
        }, token)
          .then(() => console.log(`[Capture] screenshots.log success (flagged) for capture ${id}`))
          .catch((err) => console.error("[Capture] Failed to log screenshot:", err.message));
      }

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
          ...(screenshotUrl && { screenshot_url: screenshotUrl }),
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

      // Log clean screenshot with URL
      if (user && token) {
        await callEdgeFunction("screenshots.log", {
          user_id: user.id,
          timestamp,
          rekognition_score: maxConfidence,
          flagged: false,
          labels: [],
          ...(screenshotUrl && { screenshot_url: screenshotUrl }),
        }, token)
          .then(() => console.log(`[Capture] screenshots.log success (clean) for capture ${id}`))
          .catch((err) => console.error("[Capture] Failed to log screenshot:", err.message));
      }

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
    console.error("[Capture] Error:", formatError(err));
    return null;
  }
}

function setCurrentUserId(userId) {
  currentUserId = userId || null;

  if (!currentUserId) {
    cachedUser = null;
  } else if (cachedUser && cachedUser.id !== currentUserId) {
    cachedUser = null;
  }

  waitingForUserLogged = false;
}

function setCurrentUser(user) {
  if (!user || !user.id) return;
  cachedUser = user;
  currentUserId = user.id;
  waitingForUserLogged = false;
}

function clearCurrentUser() {
  currentUserId = null;
  currentUserCache = null;
  console.log("[Capture] User cleared — capture will skip until next login");
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
      await callEdgeFunction(
        "alerts.sendEmail",
        {
          type: "evasion",
          to: user.partner_email,
          userName: user.name,
          data: { action: "paused" },
        },
        token,
      );
      console.log(
        "[Capture] Evasion alert email sent to partner via Edge Function",
      );
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

async function resumeCapture() {
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
  setCurrentUser,
  clearCurrentUser,
};
