// ============================================================
// Ascension API — Shared Types
// ============================================================

// ── Auth ──────────────────────────────────────────────────────

export interface AuthResult {
  user: { id: string; email: string } | null;
  session: Session | null;
  error: string | null;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

// ── Users ─────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  partner_id: string | null;
  partner_email: string | null;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_lapse_date: string | null;
  goals: string | null;
  partner_password_hash: string | null;
  app_disabled: boolean | null;
  lapse_reminders_sent: string[] | null;
  created_at: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired';

export interface PartnerData {
  id: string;
  name: string | null;
  email: string;
  subscription_status: SubscriptionStatus;
  streak: Streak | null;
  recentAlerts: Alert[];
}

// ── Screenshots ───────────────────────────────────────────────

export interface Screenshot {
  id: string;
  user_id: string;
  partner_id: string | null;
  timestamp: string;
  file_path: string | null;
  rekognition_score: number;
  flagged: boolean;
  reviewed: boolean;
  labels: string[] | null;
  expires_at: string | null;
  created_at: string;
}

export interface ScreenshotLog {
  user_id: string;
  partner_id?: string | null;
  timestamp: string;
  rekognition_score: number;
  flagged: boolean;
  labels: string[] | null;
  file_path?: string | null;
}

export interface ScreenshotStats {
  totalCaptures: number;
  flaggedCount: number;
  lastCaptureTime: string | null;
}

// ── Alerts ────────────────────────────────────────────────────

export type AlertType = 'attempted_access' | 'content_detected' | 'evasion';

export interface Alert {
  id: string;
  user_id: string;
  partner_id: string;
  type: AlertType;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface CreateAlert {
  user_id: string;
  partner_id: string;
  type: AlertType;
  message: string;
}

// ── Blocked Attempts ──────────────────────────────────────────

export interface BlockedAttempt {
  id?: string;
  user_id: string;
  url: string;
  timestamp?: string;
  browser: string | null;
  blocked_successfully: boolean;
}

// ── Streaks ───────────────────────────────────────────────────

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  streak_started_at: string;
  last_relapse_date: string | null;
  updated_at: string;
}

export interface WeeklyStats {
  screenshotCount: number;
  blockedCount: number;
  flaggedCount: number;
}

// ── Billing ───────────────────────────────────────────────────

export interface CheckoutResult {
  url: string | null;
  error: string | null;
}

// ── Devices (mobile) ─────────────────────────────────────────

export type Platform = 'windows' | 'macos' | 'ios' | 'android';

export interface Device {
  id: string;
  user_id: string;
  platform: Platform;
  device_name: string | null;
  push_token: string | null;
  last_heartbeat: string | null;
  app_version: string | null;
  created_at: string;
}

export interface RegisterDevice {
  user_id: string;
  platform: Platform;
  device_name?: string;
  push_token?: string;
  app_version?: string;
}

// ── Encouragements (Ally app) ─────────────────────────────────

export interface Encouragement {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface CreateEncouragement {
  from_user_id: string;
  to_user_id: string;
  message: string;
}

// ── API Client Config ─────────────────────────────────────────

export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface AscensionApiConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Base URL for Edge Functions (defaults to supabaseUrl + '/functions/v1') */
  functionsBaseUrl?: string;
  /**
   * Custom storage adapter for persisting the auth session.
   * Pass an AsyncStorage or SecureStore-backed adapter on React Native
   * so the session survives app restarts.
   */
  storage?: StorageAdapter;
}
