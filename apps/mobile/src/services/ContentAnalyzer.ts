/**
 * On-device NSFW content analysis using TensorFlow Lite.
 *
 * Runs the NSFWJS model locally - no network required.
 * The model file (nsfw_model.tflite) must be bundled in android/src/main/assets/.
 */
import {
  LOCAL_FLAG_THRESHOLD,
  FLAG_THRESHOLD,
  ALERT_THRESHOLD,
} from '@ascension/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** NSFWJS classification categories */
export interface NSFWScores {
  /** Non-sexual content */
  neutral: number;
  /** Drawings/anime (non-explicit) */
  drawing: number;
  /** Suggestive but not explicit */
  sexy: number;
  /** Animated explicit content */
  hentai: number;
  /** Explicit real content */
  porn: number;
}

export type NSFWCategory = keyof NSFWScores;

export interface AnalysisResult {
  scores: NSFWScores;
  /** Highest-scoring NSFW category (excluding neutral/drawing) */
  topCategory: NSFWCategory;
  /** Score of the top NSFW category (0-100) */
  topScore: number;
  /** Whether the image crosses the local flagging threshold */
  flagged: boolean;
  /** Whether the image crosses the immediate alert threshold */
  alert: boolean;
}

// ---------------------------------------------------------------------------
// TFLite model interface
//
// The actual TFLite interpreter is loaded via react-native-tflite or a
// similar library. We define the interface here so the rest of the code
// is decoupled from the specific library choice.
// ---------------------------------------------------------------------------

interface TFLiteModel {
  run(input: Float32Array): Promise<Float32Array>;
  close(): void;
}

let model: TFLiteModel | null = null;

/**
 * Load the NSFWJS TFLite model from bundled assets.
 * Call once at app startup. Subsequent calls are no-ops.
 */
export async function loadModel(): Promise<void> {
  if (model) return;

  try {
    // Dynamic import so this module can be loaded on iOS without crashing.
    // The actual TFLite library (e.g. react-native-tflite) provides loadModel.
    const tflite = require('react-native-tflite');
    model = await tflite.loadModel({
      model: 'nsfw_model.tflite',
      // The NSFWJS model expects 224x224 RGB input
      inputShape: [1, 224, 224, 3],
    });
  } catch (err) {
    console.error('[ContentAnalyzer] Failed to load TFLite model:', err);
    throw err;
  }
}

/**
 * Release the TFLite model from memory.
 */
export function unloadModel(): void {
  model?.close();
  model = null;
}

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

/**
 * Decode a base64 JPEG image into a Float32Array of normalised RGB pixels
 * sized for the NSFWJS input tensor (224 x 224 x 3).
 *
 * This is a simplified stub. In production, use a canvas-based or native
 * image decoder (e.g. expo-image-manipulator or a custom native helper)
 * to resize and extract pixel data.
 */
async function preprocessImage(base64: string): Promise<Float32Array> {
  // In a real implementation this would:
  // 1. Decode the JPEG from base64
  // 2. Resize to 224x224
  // 3. Extract RGB channels normalised to [0, 1]
  //
  // For now we use the expo-image-manipulator approach:
  try {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const uri = `data:image/jpeg;base64,${base64}`;

    // Resize to model input dimensions
    const resized = await manipulateAsync(
      uri,
      [{ resize: { width: 224, height: 224 } }],
      { format: SaveFormat.PNG, base64: true }
    );

    // Decode the resized PNG to raw pixels via a canvas or native helper.
    // This is platform-specific; we rely on a helper that returns Uint8Array.
    const rawPixels = await decodeToRawPixels(resized.base64!);

    // Normalise to [0, 1] Float32Array (RGB only, skip alpha)
    const float32 = new Float32Array(224 * 224 * 3);
    let idx = 0;
    for (let i = 0; i < rawPixels.length; i += 4) {
      float32[idx++] = rawPixels[i] / 255;     // R
      float32[idx++] = rawPixels[i + 1] / 255; // G
      float32[idx++] = rawPixels[i + 2] / 255; // B
    }
    return float32;
  } catch {
    // Fallback: return empty tensor (will classify as neutral)
    return new Float32Array(224 * 224 * 3);
  }
}

/**
 * Stub for raw pixel extraction. Replace with a native implementation
 * (e.g. a small Kotlin helper exposed to RN) for production use.
 */
async function decodeToRawPixels(base64Png: string): Promise<Uint8Array> {
  // TODO: Implement native pixel extraction
  // For now return a blank image that will score as neutral
  return new Uint8Array(224 * 224 * 4);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Parse raw model output into labelled scores.
 * NSFWJS output order: drawing, hentai, neutral, porn, sexy
 */
function parseScores(output: Float32Array): NSFWScores {
  return {
    drawing: (output[0] ?? 0) * 100,
    hentai: (output[1] ?? 0) * 100,
    neutral: (output[2] ?? 0) * 100,
    porn: (output[3] ?? 0) * 100,
    sexy: (output[4] ?? 0) * 100,
  };
}

/**
 * Analyse a base64-encoded screenshot for NSFW content.
 *
 * @param base64 - JPEG screenshot as base64 (no data URI prefix)
 * @returns Classification result with scores and flag/alert status
 */
export async function analyzeImage(base64: string): Promise<AnalysisResult> {
  if (!model) {
    throw new Error('TFLite model not loaded. Call loadModel() first.');
  }

  const input = await preprocessImage(base64);
  const output = await model.run(input);
  const scores = parseScores(output);

  // Determine the top NSFW category (exclude neutral and drawing)
  const nsfwCategories: NSFWCategory[] = ['porn', 'hentai', 'sexy'];
  let topCategory: NSFWCategory = 'neutral';
  let topScore = 0;

  for (const cat of nsfwCategories) {
    if (scores[cat] > topScore) {
      topScore = scores[cat];
      topCategory = cat;
    }
  }

  // If no NSFW category scored above zero, use neutral
  if (topScore === 0) {
    topCategory = 'neutral';
    topScore = scores.neutral;
  }

  return {
    scores,
    topCategory,
    topScore,
    flagged: topScore >= LOCAL_FLAG_THRESHOLD,
    alert: topScore >= ALERT_THRESHOLD,
  };
}
