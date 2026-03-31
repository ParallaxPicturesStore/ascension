/**
 * Local NSFW analyzer using NSFWJS + TensorFlow.js
 * Runs entirely on-device — zero API cost.
 * Only images that exceed the local threshold get sent to Rekognition for verification.
 */

const sharp = require("sharp");

// Lazy-load TF and NSFWJS so startup isn't blocked
let tf = null;
let nsfw = null;
let model = null;
let modelLoading = false;
let modelFailed = false;

function setupBackend() {
  // Use pure JS CPU backend — no native bindings required
  require("@tensorflow/tfjs-backend-cpu");
  tf = require("@tensorflow/tfjs");
  tf.setBackend("cpu");
}

// % explicit score (porn + hentai) that triggers Rekognition verification
const LOCAL_FLAG_THRESHOLD = 25;

async function getModel() {
  if (model) return model;
  if (modelFailed) return null;
  if (modelLoading) {
    while (modelLoading) await new Promise((r) => setTimeout(r, 200));
    return model;
  }

  modelLoading = true;
  try {
    setupBackend();
    nsfw = require("nsfwjs");
    console.log("[LocalAnalyzer] Loading NSFW model...");
    model = await nsfw.load();
    console.log("[LocalAnalyzer] Model ready");
  } catch (err) {
    console.error("[LocalAnalyzer] Model load failed:", err.message);
    modelFailed = true;
  } finally {
    modelLoading = false;
  }
  return model;
}

async function analyzeLocally(buffer) {
  const m = await getModel();
  if (!m) return null; // fall through to Rekognition

  try {
    // Resize to 224x224 RGB and get raw pixels
    const { data, info } = await sharp(buffer)
      .resize(224, 224)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
    const predictions = await m.classify(tensor);
    tensor.dispose();

    const porn = (predictions.find((p) => p.className === "Porn")?.probability || 0) * 100;
    const hentai = (predictions.find((p) => p.className === "Hentai")?.probability || 0) * 100;
    const sexy = (predictions.find((p) => p.className === "Sexy")?.probability || 0) * 100;

    // Weighted explicit score — porn/hentai are hard flags, sexy is a soft flag
    const explicitScore = porn + hentai + sexy * 0.3;

    const needsVerification = explicitScore >= LOCAL_FLAG_THRESHOLD;

    if (needsVerification) {
      console.log(
        `[LocalAnalyzer] Suspect: porn=${porn.toFixed(1)}% hentai=${hentai.toFixed(1)}% sexy=${sexy.toFixed(1)}% → sending to Rekognition`
      );
    }

    return {
      needsVerification,
      localScore: Math.round(explicitScore),
      categories: {
        porn: Math.round(porn),
        hentai: Math.round(hentai),
        sexy: Math.round(sexy),
      },
    };
  } catch (err) {
    console.error("[LocalAnalyzer] Analysis error:", err.message);
    return null; // fall through to Rekognition on error
  }
}

// Pre-load model at startup so first scan isn't delayed
getModel().catch(() => {});

module.exports = { analyzeLocally };
