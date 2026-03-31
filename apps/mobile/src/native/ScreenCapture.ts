/**
 * TypeScript bridge for the native ScreenCaptureModule (Android).
 *
 * Exposes start/stop/status methods and an event emitter for captured
 * screenshots that the MonitoringService can subscribe to.
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureStatus = 'active' | 'inactive' | 'permission_denied';

export interface ScreenshotEvent {
  /** JPEG image encoded as a base64 string (no data URI prefix) */
  base64: string;
  /** Unix timestamp in milliseconds when the screenshot was taken */
  timestamp: number;
}

interface NativeScreenCaptureModule {
  startCapture(): Promise<boolean>;
  stopCapture(): Promise<void>;
  getCaptureStatus(): Promise<CaptureStatus>;
  setInterval(intervalMs: number): void;
}

// ---------------------------------------------------------------------------
// Module resolution
// ---------------------------------------------------------------------------

const NativeModule: NativeScreenCaptureModule | undefined =
  Platform.OS === 'android'
    ? NativeModules.ScreenCaptureModule
    : undefined;

const emitter =
  Platform.OS === 'android' && NativeModule
    ? new NativeEventEmitter(NativeModules.ScreenCaptureModule)
    : null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request MediaProjection permission and begin periodic screen capture.
 * A system dialog will appear asking the user for consent.
 *
 * @returns true if capture started successfully
 * @throws if the user denies permission or no activity is available
 */
export async function startCapture(): Promise<boolean> {
  if (!NativeModule) {
    throw new Error('ScreenCaptureModule is only available on Android');
  }
  return NativeModule.startCapture();
}

/**
 * Stop screen capture and release all native resources.
 */
export async function stopCapture(): Promise<void> {
  if (!NativeModule) return;
  return NativeModule.stopCapture();
}

/**
 * Query the current capture status.
 */
export async function getCaptureStatus(): Promise<CaptureStatus> {
  if (!NativeModule) return 'inactive';
  return NativeModule.getCaptureStatus();
}

/**
 * Update the interval between captures (in milliseconds).
 * Takes effect immediately if capture is already running.
 */
export function setCaptureInterval(intervalMs: number): void {
  NativeModule?.setInterval(intervalMs);
}

/**
 * Subscribe to screenshot capture events.
 *
 * @param callback - Invoked each time a screenshot is captured
 * @returns An unsubscribe function
 */
export function onScreenshotCaptured(
  callback: (event: ScreenshotEvent) => void
): () => void {
  if (!emitter) {
    return () => {};
  }

  const subscription = emitter.addListener('onScreenshotCaptured', callback);
  return () => subscription.remove();
}
