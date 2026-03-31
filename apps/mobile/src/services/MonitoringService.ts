/**
 * MonitoringService - Orchestrates the screen capture + analysis pipeline.
 *
 * Flow:
 *   1. Start screen capture (native module)
 *   2. Listen for captured screenshots
 *   3. Run on-device NSFW analysis
 *   4. If flagged: upload screenshot + create alert via API
 *   5. Report heartbeat to API
 */
import {
  startCapture,
  stopCapture,
  onScreenshotCaptured,
  type ScreenshotEvent,
  type CaptureStatus,
} from '../native/ScreenCapture';
import {
  loadModel,
  unloadModel,
  analyzeImage,
  type AnalysisResult,
} from './ContentAnalyzer';
import { sendHeartbeat, reportFlag } from './AntiTamper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitoringState {
  status: CaptureStatus;
  lastScreenshot: number | null;
  lastAnalysis: AnalysisResult | null;
  screenshotsAnalyzed: number;
  flagsRaised: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let state: MonitoringState = {
  status: 'inactive',
  lastScreenshot: null,
  lastAnalysis: null,
  screenshotsAnalyzed: 0,
  flagsRaised: 0,
};

let unsubscribeCapture: (() => void) | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialise and start the monitoring pipeline.
 *
 * @param userId - Authenticated user's ID (for API calls)
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase anon key
 */
export async function startMonitoring(
  userId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  // Load TFLite model
  await loadModel();

  // Start native screen capture
  await startCapture();

  // Listen for screenshots
  unsubscribeCapture = onScreenshotCaptured((event) => {
    handleScreenshot(event, userId, supabaseUrl, supabaseKey);
  });

  // Start heartbeat
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(userId, supabaseUrl, supabaseKey).catch((err) =>
      console.warn('[MonitoringService] Heartbeat failed:', err)
    );
  }, HEARTBEAT_INTERVAL_MS);

  // Send an initial heartbeat immediately
  sendHeartbeat(userId, supabaseUrl, supabaseKey).catch(() => {});

  state.status = 'active';
}

/**
 * Stop the monitoring pipeline and release all resources.
 */
export async function stopMonitoring(): Promise<void> {
  unsubscribeCapture?.();
  unsubscribeCapture = null;

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  await stopCapture();
  unloadModel();

  state.status = 'inactive';
}

/**
 * Get a snapshot of the current monitoring state.
 */
export function getMonitoringState(): MonitoringState {
  return { ...state };
}

// ---------------------------------------------------------------------------
// Screenshot handling
// ---------------------------------------------------------------------------

async function handleScreenshot(
  event: ScreenshotEvent,
  userId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  state.lastScreenshot = event.timestamp;

  try {
    const result = await analyzeImage(event.base64);
    state.lastAnalysis = result;
    state.screenshotsAnalyzed++;

    if (result.flagged) {
      state.flagsRaised++;

      await reportFlag({
        userId,
        supabaseUrl,
        supabaseKey,
        base64: event.base64,
        timestamp: event.timestamp,
        scores: result.scores,
        topCategory: result.topCategory,
        topScore: result.topScore,
        isAlert: result.alert,
      });
    }
  } catch (err) {
    console.error('[MonitoringService] Analysis failed:', err);
  }
}
