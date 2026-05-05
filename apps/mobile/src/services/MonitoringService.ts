/**
 * MonitoringService - Orchestrates the screen capture + analysis pipeline.
 *
 * Flow:
 *   1. Start native screen capture (Android only)
 *   2. Listen for captured screenshots → run cloud NSFW analysis (Rekognition)
 *   3. If flagged → upload screenshot + create alert via ascension-api
 *   4. Send "online" heartbeat every 2 minutes so the server knows the
 *      app is alive. On intentional stop, send "going_offline" first.
 *   5. Emit detections to any registered callbacks (e.g. for in-app alerts)
 *
 * Platform notes:
 *   Android - VPN/DNS filtering (AscensionVpnService) blocks sites at OS level,
 *             including incognito tabs. Also runs MediaProjection + cloud NSFW
 *             analysis for screen content.
 *   iOS     - VPN/DNS filtering via NEPacketTunnelProvider network extension.
 */
import { Platform } from 'react-native';
import {
  startCapture,
  stopCapture,
  getCaptureStatus,
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
import { vpnManager } from '../native/VPNManager';
import { sendHeartbeat, reportFlag, reportVPNBlock } from './AntiTamper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitoringState {
  status: CaptureStatus | 'inactive';
  lastScreenshot: number | null;
  lastAnalysis: AnalysisResult | null;
  screenshotsAnalyzed: number;
  flagsRaised: number;
}

// ---------------------------------------------------------------------------
// Module-level state
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
let vpnSyncInterval: ReturnType<typeof setInterval> | null = null;

// Credentials stored at module level for heartbeat and analysis closures
let _userId = '';
let _supabaseUrl = '';
let _userAccessToken = '';
let _supabaseAnonKey = '';
let _platform: 'android' | 'ios' = 'android';

// Tracks the most recent blocked-attempt timestamp we have already synced
// so we don't re-report the same entries on every poll cycle.
let _lastSyncedBlockTimestamp = 0;

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const VPN_SYNC_INTERVAL_MS  = 2 * 60 * 1000; // sync blocked attempts every 2 minutes

// ---------------------------------------------------------------------------
// Detection callbacks
// ---------------------------------------------------------------------------

type DetectionCallback = (result: AnalysisResult) => void;
const detectionCallbacks: Set<DetectionCallback> = new Set();

/**
 * Subscribe to NSFW detection events.
 *
 * The callback is invoked every time a flagged screenshot is analysed,
 * including alert-level detections. Returns an unsubscribe function.
 *
 * @example
 *   const unsub = onDetection((result) => showAlert(result));
 *   // later:
 *   unsub();
 */
export function onDetection(callback: DetectionCallback): () => void {
  detectionCallbacks.add(callback);
  return () => detectionCallbacks.delete(callback);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialise and start the monitoring pipeline.
 *
 * @param userId           - Authenticated user's ID
 * @param supabaseUrl      - Supabase project URL
 * @param userAccessToken  - User's JWT (from supabase.auth.getSession)
 * @param supabaseAnonKey  - Project anon key (for apikey header)
 */
export async function startMonitoring(
  userId: string,
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
): Promise<void> {
  // Store for heartbeat / analysis closures
  _userId = userId;
  _supabaseUrl = supabaseUrl;
  _userAccessToken = userAccessToken;
  _supabaseAnonKey = supabaseAnonKey;
  _platform = Platform.OS === 'ios' ? 'ios' : 'android';

  // iOS only: start the VPN DNS filter tunnel + begin syncing blocked attempts
  if (Platform.OS === 'ios') {
    if (vpnManager.isAvailable) {
      // Store credentials in the App Group so the iOS VPN extension can call
      // Supabase directly and fire partner alerts even when the app is closed.
      await vpnManager.storeCredentials(userId, supabaseUrl, userAccessToken, supabaseAnonKey)
        .catch(() => {});

      const started = await vpnManager.startVPN();
      console.log(`[MonitoringService] VPN tunnel ${started ? 'started' : 'already running or denied'}`);

      // Seed the cursor so we only report blocks that happen after this start
      const existing = await vpnManager.getRecentBlocked();
      _lastSyncedBlockTimestamp = existing.length > 0
        ? Math.max(...existing.map((e) => e.timestamp))
        : Math.floor(Date.now() / 1000);

      vpnSyncInterval = setInterval(() => {
        syncVPNBlocks().catch((err) =>
          console.warn('[MonitoringService] VPN sync failed:', err),
        );
      }, VPN_SYNC_INTERVAL_MS);
    } else {
      console.warn('[MonitoringService] VPN module not available on this platform/build');
    }
  }

  // Android-only: load model (no-op for API-based analyzer) and start capture
  if (Platform.OS === 'android') {
    console.log('[MonitoringService] Loading model...');
    await loadModel();

    // Skip the permission dialog if capture is already running (e.g. after a JS reload
    // or if startMonitoring is called a second time in the same native session).
    const captureStatus = await getCaptureStatus();
    if (captureStatus !== 'active') {
      console.log('[MonitoringService] Requesting screen capture permission...');
      await startCapture();
      console.log('[MonitoringService] Screen capture started — listening for screenshots');
    } else {
      console.log('[MonitoringService] Screen capture already active — skipping permission dialog');
    }

    unsubscribeCapture = onScreenshotCaptured((event) => {
      console.log(`[MonitoringService] Screenshot received ts=${event.timestamp} size=${event.base64.length}B`);
      handleScreenshot(event);
    });
  }

  // Start heartbeat loop (both platforms)
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(_userId, _supabaseUrl, _userAccessToken, _supabaseAnonKey, 'online', _platform)
      .catch((err) => console.warn('[MonitoringService] Heartbeat failed:', err));
  }, HEARTBEAT_INTERVAL_MS);

  // Send an initial "online" heartbeat immediately
  sendHeartbeat(userId, supabaseUrl, userAccessToken, supabaseAnonKey, 'online', _platform)
    .catch(() => {});

  state.status = Platform.OS === 'android' ? 'active' : 'inactive';
  console.log(`[MonitoringService] Started — platform=${_platform} status=${state.status}`);
}

/**
 * Stop the monitoring pipeline.
 *
 * Sends a "going_offline" heartbeat first so the server knows this
 * silence is intentional and does NOT trigger an evasion alert.
 */
export async function stopMonitoring(): Promise<void> {
  // Tell the server this stop is intentional before cutting the connection
  if (_userId && _supabaseUrl && _userAccessToken) {
    await sendHeartbeat(
      _userId, _supabaseUrl, _userAccessToken, _supabaseAnonKey,
      'going_offline', _platform,
    ).catch(() => {}); // best-effort
  }

  // Tear down capture listener
  unsubscribeCapture?.();
  unsubscribeCapture = null;

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (vpnManager.isAvailable) {
    if (vpnSyncInterval) {
      clearInterval(vpnSyncInterval);
      vpnSyncInterval = null;
    }
    await vpnManager.stopVPN();
  }

  if (Platform.OS === 'android') {
    await stopCapture();
    unloadModel();
  }

  state = {
    status: 'inactive',
    lastScreenshot: null,
    lastAnalysis: null,
    screenshotsAnalyzed: 0,
    flagsRaised: 0,
  };
}

/**
 * Update the user's access token (call this after a token refresh).
 * Also refreshes the token stored in the App Group for the VPN extension.
 */
export function updateAccessToken(newToken: string): void {
  _userAccessToken = newToken;
  vpnManager.storeCredentials(_userId, _supabaseUrl, newToken, _supabaseAnonKey).catch(() => {});
}

/**
 * Get a snapshot of the current monitoring state.
 */
export function getMonitoringState(): MonitoringState {
  return { ...state };
}

// ---------------------------------------------------------------------------
// VPN blocked-attempt sync (iOS only)
// ---------------------------------------------------------------------------

/**
 * Poll the shared App Group for new blocked attempts written by the
 * PacketTunnelProvider extension and report each unseen one to the server.
 * Uses _lastSyncedBlockTimestamp as a cursor to avoid double-reporting.
 */
async function syncVPNBlocks(): Promise<void> {
  const entries = await vpnManager.getRecentBlocked();
  const unseen = entries.filter((e) => e.timestamp > _lastSyncedBlockTimestamp);
  if (unseen.length === 0) return;

  console.log(`[MonitoringService] Syncing ${unseen.length} new VPN block(s)`);

  for (const entry of unseen) {
    await reportVPNBlock(
      _userId,
      _supabaseUrl,
      _userAccessToken,
      _supabaseAnonKey,
      entry.domain,
      entry.timestamp,
    ).catch((err: unknown) =>
      console.warn('[MonitoringService] Failed to report VPN block:', err),
    );
    if (entry.timestamp > _lastSyncedBlockTimestamp) {
      _lastSyncedBlockTimestamp = entry.timestamp;
    }
  }
}

// ---------------------------------------------------------------------------
// Screenshot handling (Android only)
// ---------------------------------------------------------------------------

async function handleScreenshot(event: ScreenshotEvent): Promise<void> {
  state.lastScreenshot = event.timestamp;
  const n = state.screenshotsAnalyzed + 1;
  console.log(`[MonitoringService] Analysing screenshot #${n}...`);

  try {
    const result = await analyzeImage(event.base64, {
      supabaseUrl: _supabaseUrl,
      userAccessToken: _userAccessToken,
      supabaseAnonKey: _supabaseAnonKey,
      userId: _userId,
    });

    state.lastAnalysis = result;
    state.screenshotsAnalyzed++;

    if (result.flagged) {
      console.warn(
        `[MonitoringService] FLAGGED #${n} — category=${result.topCategory}`,
        `score=${Math.round(result.topScore)}% alert=${result.alert}`,
        `labels=${result.labels.join(', ')}`,
      );
      state.flagsRaised++;

      // Notify in-app subscribers (e.g. for UI alert modals)
      detectionCallbacks.forEach((cb) => {
        try { cb(result); } catch { /* ignore callback errors */ }
      });

      // Report to the server and alert partner if alert-level
      await reportFlag({
        userId: _userId,
        userAccessToken: _userAccessToken,
        supabaseUrl: _supabaseUrl,
        supabaseAnonKey: _supabaseAnonKey,
        base64: event.base64,
        timestamp: event.timestamp,
        labels: result.labels.length > 0 ? result.labels : [result.topCategory],
        topCategory: result.topCategory,
        topScore: result.topScore,
        isAlert: result.alert,
      });
    } else {
      console.log(
        `[MonitoringService] Clean #${n} — category=${result.topCategory}`,
        `score=${Math.round(result.topScore)}%`,
      );
    }
  } catch (err) {
    console.error('[MonitoringService] Analysis failed:', err);
  }
}
