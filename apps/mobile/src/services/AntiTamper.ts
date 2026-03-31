/**
 * AntiTamper - Heartbeat and tamper detection for the monitoring service.
 *
 * - Sends a heartbeat to the API every 2 minutes
 * - If the app is force-stopped or uninstalled, the server-side heartbeat
 *   checker (Supabase Edge Function) will notice the gap and alert the partner
 * - Detects if monitoring was manually stopped and reports evasion
 */
import { AlertType } from '@ascension/shared';
import type { NSFWScores, NSFWCategory } from './ContentAnalyzer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlagReport {
  userId: string;
  supabaseUrl: string;
  supabaseKey: string;
  base64: string;
  timestamp: number;
  scores: NSFWScores;
  topCategory: NSFWCategory;
  topScore: number;
  isAlert: boolean;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

/**
 * Send a heartbeat to the Supabase Edge Function.
 * The server records the timestamp; if no heartbeat arrives within the
 * expected window, it triggers an evasion alert to the partner.
 */
export async function sendHeartbeat(
  userId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/monitoring-heartbeat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({
      user_id: userId,
      timestamp: new Date().toISOString(),
      platform: 'android',
      status: 'active',
    }),
  });

  if (!response.ok) {
    throw new Error(`Heartbeat failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Report an evasion event (monitoring was tampered with).
 */
export async function reportEvasion(
  userId: string,
  supabaseUrl: string,
  supabaseKey: string,
  reason: string
): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/report-evasion`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({
      user_id: userId,
      timestamp: new Date().toISOString(),
      platform: 'android',
      reason,
      alert_type: AlertType.Evasion,
    }),
  });
}

// ---------------------------------------------------------------------------
// Flag reporting
// ---------------------------------------------------------------------------

/**
 * Upload a flagged screenshot and create an alert via the API.
 *
 * For flagged (but not alert-level) content, the screenshot is logged for
 * review. For alert-level content, the partner is notified immediately.
 */
export async function reportFlag(report: FlagReport): Promise<void> {
  const {
    userId,
    supabaseUrl,
    supabaseKey,
    base64,
    timestamp,
    scores,
    topCategory,
    topScore,
    isAlert,
  } = report;

  // 1. Upload screenshot record
  const screenshotUrl = `${supabaseUrl}/rest/v1/screenshots`;
  const screenshotResponse = await fetch(screenshotUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      timestamp: new Date(timestamp).toISOString(),
      rekognition_score: topScore,
      flagged: true,
      reviewed: false,
      labels: [topCategory, ...Object.entries(scores)
        .filter(([k, v]) => v > 10 && k !== topCategory)
        .map(([k]) => k)],
    }),
  });

  if (!screenshotResponse.ok) {
    console.error(
      '[AntiTamper] Failed to upload screenshot:',
      screenshotResponse.status
    );
    return;
  }

  // 2. If alert-level, upload the image to storage for partner review
  if (isAlert) {
    try {
      const storagePath = `screenshots/${userId}/${timestamp}.jpg`;
      const storageUrl = `${supabaseUrl}/storage/v1/object/${storagePath}`;

      // Convert base64 to binary for upload
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: bytes,
      });
    } catch (err) {
      console.warn('[AntiTamper] Failed to upload image to storage:', err);
      // Non-fatal: the screenshot record was still created
    }
  }

  // 3. If alert-level, create an alert for the partner
  if (isAlert) {
    const alertUrl = `${supabaseUrl}/rest/v1/rpc/create_content_alert`;

    await fetch(alertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_type: AlertType.ContentDetected,
        p_message: `NSFW content detected (${topCategory}: ${Math.round(topScore)}%)`,
        p_timestamp: new Date(timestamp).toISOString(),
      }),
    });
  }
}
