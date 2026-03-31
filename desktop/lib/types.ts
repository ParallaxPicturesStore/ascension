export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          partner_id: string | null;
          partner_email: string | null;
          stripe_customer_id: string | null;
          subscription_status: string;
          goals: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          partner_id?: string | null;
          partner_email?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: string;
          goals?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          partner_id?: string | null;
          partner_email?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: string;
          goals?: string | null;
        };
      };
      screenshots: {
        Row: {
          id: string;
          user_id: string;
          timestamp: string;
          file_path: string | null;
          rekognition_score: number;
          flagged: boolean;
          reviewed: boolean;
          labels: string[] | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          timestamp?: string;
          file_path?: string | null;
          rekognition_score?: number;
          flagged?: boolean;
          reviewed?: boolean;
          labels?: string[] | null;
        };
        Update: {
          file_path?: string | null;
          rekognition_score?: number;
          flagged?: boolean;
          reviewed?: boolean;
          labels?: string[] | null;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          partner_id: string;
          type: string;
          message: string;
          timestamp: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          partner_id: string;
          type: string;
          message: string;
          timestamp?: string;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
      blocked_attempts: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          timestamp: string;
          browser: string | null;
          blocked_successfully: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          timestamp?: string;
          browser?: string | null;
          blocked_successfully?: boolean;
        };
        Update: {
          blocked_successfully?: boolean;
        };
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_relapse_date: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_relapse_date?: string | null;
        };
        Update: {
          current_streak?: number;
          longest_streak?: number;
          last_relapse_date?: string | null;
        };
      };
    };
  };
}

// Electron IPC bridge type
declare global {
  interface Window {
    ascension?: {
      pauseCapture: () => Promise<{ status: string }>;
      resumeCapture: () => Promise<{ status: string }>;
      getCaptureStatus: () => Promise<{ status: string }>;
      notifyLoggedIn: (userId: string) => Promise<{ ok: boolean }>;
      showWindow: () => Promise<void>;
      hideWindow: () => Promise<void>;
      quitApp: (partnerPassword: string) => Promise<{ success: boolean; error?: string }>;
      setQuitPassword: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
      getAppInfo: () => Promise<{
        version: string;
        captureState: string;
        platform: string;
      }>;
      // Alerts
      sendAlert: (type: string, partnerEmail: string, userName: string, data: Record<string, unknown>) => Promise<unknown>;
      invitePartner: (partnerEmail: string, userName: string) => Promise<unknown>;
      // Streak
      getStreak: (userId: string) => Promise<{
        current_streak: number;
        longest_streak: number;
        last_relapse_date: string | null;
      } | null>;
      resetStreak: (userId: string) => Promise<boolean>;
      getWeeklyStats: (userId: string) => Promise<{
        screenshotCount: number;
        blockedCount: number;
        flaggedCount: number;
      }>;
      // Billing
      openCheckout: (userId: string, userEmail: string, plan: string) => Promise<{ success: boolean; url?: string }>;
      getSubscriptionStatus: (userId: string) => Promise<string>;
      openBillingPortal: (customerId: string) => Promise<{ success: boolean }>;
      // Screenshots
      getRecentScreenshots: () => Promise<unknown[]>;
      getScreenshotStats: () => Promise<{
        totalCaptures: number;
        flaggedCount: number;
        lastCaptureTime: string | null;
      }>;
      // Shell
      openExternal: (url: string) => Promise<void>;
      // Events
      onCaptureEvent: (callback: (data: CaptureEvent) => void) => () => void;
      onAppHidden: (callback: () => void) => () => void;
      onSubscriptionLocked: (callback: () => void) => () => void;
    };
  }
}

export interface CaptureEvent {
  type: "clean" | "flagged" | "immediate_alert" | "paused" | "resumed";
  id?: string;
  timestamp: string;
  confidence?: number;
  labels?: string[];
  blurredPath?: string;
}
