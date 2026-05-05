/**
 * AntiTamper - Heartbeat and tamper detection for the monitoring service.
 *
 * - Sends a heartbeat to ascension-api every 2 minutes with status "online"
 * - Sends "going_offline" before intentional stops (logout, explicit stop)
 * - If the app is force-stopped/uninstalled, heartbeats simply stop arriving;
 *   the server-side cron (monitoring.checkEvasion) notices the gap and alerts
 * - Detects if monitoring permissions are revoked and reports evasion directly
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlagReport {
  userId: string;
  userAccessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  base64: string;
  timestamp: number;
  labels: string[];
  topCategory: string;
  topScore: number;
  isAlert: boolean;
}

// ---------------------------------------------------------------------------
// Shared fetch helper for ascension-api
// ---------------------------------------------------------------------------

async function callApi(
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/ascension-api`;

  console.log(`[AntiTamper] → ${action}`, JSON.stringify(payload));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAccessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    console.error(`[AntiTamper] ✗ ${action} failed (${res.status}):`, text);
    throw new Error(`${action} failed: ${res.status} ${text}`);
  }

  console.log(`[AntiTamper] ✓ ${action} OK (${res.status})`);
}

// ---------------------------------------------------------------------------
// Streak reset
// ---------------------------------------------------------------------------

async function resetStreak(
  userId: string,
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
): Promise<boolean> {
  try {
    await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'streaks.reset', { user_id: userId });
    console.log(`[Streak] Reset for user ${userId}`);
    return true;
  } catch (err) {
    console.error('[Streak] Error resetting:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

/**
 * Send a heartbeat to ascension-api.
 *
 * status "online"        → app is actively monitoring
 * status "going_offline" → last ping before intentional silence
 *                          (send this before any deliberate stop so the
 *                           server-side evasion check doesn't false-alert)
 */
export async function sendHeartbeat(
  userId: string,
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
  status: 'online' | 'going_offline' = 'online',
  platform: 'android' | 'ios' = 'android',
): Promise<void> {
  console.log(`[AntiTamper] Heartbeat [${status}] user=${userId} platform=${platform}`);
  await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'monitoring.heartbeat', {
    user_id: userId,
    status,
    platform,
  });
}

// ---------------------------------------------------------------------------
// Evasion reporting
// ---------------------------------------------------------------------------

/**
 * Report an evasion event (monitoring was tampered with).
 * Called when the app detects permissions have been revoked or the
 * accessibility/capture service was killed while the device is online.
 */
export async function reportEvasion(
  userId: string,
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
  reason: string,
  platform: 'android' | 'ios' = 'android',
): Promise<void> {
  console.warn(`[AntiTamper] EVASION DETECTED user=${userId} platform=${platform} reason=${reason}`);
  await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'monitoring.reportEvasion', {
    user_id: userId,
    reason,
    platform,
  });
}

// ---------------------------------------------------------------------------
// VPN block reporting (iOS)
// ---------------------------------------------------------------------------

/**
 * Report a domain blocked by the VPN DNS filter.
 * Calls blocked_attempts.logAndAlert which logs the block, creates a partner
 * alert in the DB, resets the streak, and emails the partner.
 * This is the fallback path for blocks the extension couldn't report directly
 * (e.g. token was expired at block time).
 */
export async function reportVPNBlock(
  userId: string,
  supabaseUrl: string,
  userAccessToken: string,
  supabaseAnonKey: string,
  domain: string,
  blockedAt: number, // Unix seconds
): Promise<void> {
  console.warn(`[AntiTamper] VPN BLOCK user=${userId} domain=${domain}`);
  await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'blocked_attempts.logAndAlert', {
    user_id: userId,
    domain,
    blocked_at: new Date(blockedAt * 1000).toISOString(),
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
    userAccessToken,
    supabaseUrl,
    supabaseAnonKey,
    base64,
    timestamp,
    labels,
    topCategory,
    topScore,
    isAlert,
  } = report;

  console.warn(
    `[AntiTamper] FLAG RAISED user=${userId}`,
    `category=${topCategory} score=${Math.round(topScore)}%`,
    `alert=${isAlert} labels=${labels.join(', ')}`,
  );

  // 1. Fetch profile early so partner_id is available for the screenshot log
  let partnerId: string | null = null;
  let partnerEmail: string | null = null;
  let userName = 'User';
  const profileUrl = `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=name,partner_id,partner_email`;
  const profileRes = await fetch(profileUrl, {
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      apikey: supabaseAnonKey,
      Accept: 'application/json',
    },
  });
  if (profileRes.ok) {
    const rows: Array<{ name: string | null; partner_id: string | null; partner_email: string | null }> = await profileRes.json();
    partnerId = rows[0]?.partner_id ?? null;
    partnerEmail = rows[0]?.partner_email ?? null;
    userName = rows[0]?.name ?? 'User';
  } else {
    console.warn('[AntiTamper] Failed to fetch user profile:', profileRes.status);
  }

  // 2. If alert-level, upload the image to storage first so we have the path for the log
  let screenshotStoragePath: string | null = null;
  if (isAlert) {
    try {
      screenshotStoragePath = `screenshots/${userId}/${timestamp}.jpg`;
      const storageUrl = `${supabaseUrl}/storage/v1/object/${screenshotStoragePath}`;
      console.log('[AntiTamper] Uploading screenshot image to storage:', screenshotStoragePath);

      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const storageRes = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${userAccessToken}`,
          apikey: supabaseAnonKey,
        },
        body: bytes,
      });

      if (storageRes.ok) {
        console.log('[AntiTamper] ✓ Image uploaded to storage');
      } else {
        console.warn('[AntiTamper] Storage upload returned', storageRes.status);
        screenshotStoragePath = null;
      }
    } catch (err) {
      console.warn('[AntiTamper] Failed to upload image to storage:', err);
      screenshotStoragePath = null;
    }
  }

  // 2. Log screenshot via ascension-api
  console.log('[AntiTamper] Logging screenshot record...');
  await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'screenshots.log', {
    user_id: userId,
    ...(partnerId && { partner_id: partnerId }),
    timestamp: new Date(timestamp).toISOString(),
    rekognition_score: topScore,
    flagged: true,
    labels: labels.length > 0 ? labels : [topCategory],
    ...(screenshotStoragePath && { file_path: screenshotStoragePath }),
  });

  // 3. If alert-level, create an alert + send email to partner
  if (isAlert) {
    if (partnerId) {
      console.log('[AntiTamper] Creating partner alert for partner_id:', partnerId);
      await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'alerts.create', {
        user_id: userId,
        partner_id: partnerId,
        type: 'content_detected',
        message: `NSFW content detected (${topCategory}: ${Math.round(topScore)}%)`,
      });
      await resetStreak(userId, supabaseUrl, userAccessToken, supabaseAnonKey);
    } else {
      console.log('[AntiTamper] No partner linked — skipping alert');
    }

    if (partnerEmail) {
      console.log('[AntiTamper] Sending alert email to partner:', partnerEmail);
      await callApi(supabaseUrl, userAccessToken, supabaseAnonKey, 'alerts.sendEmail', {
        type: 'content_detected',
        to: partnerEmail,
        userName,
        data: {
          confidence: Math.round(topScore).toString(),
          labels: labels.join(', '),
        },
      });
    } else {
      console.log('[AntiTamper] No partner email — skipping email');
    }
  }
}
