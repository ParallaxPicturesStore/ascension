/**
 * Shared database types for Ascension.
 * Extracted from the Supabase schema — used by desktop, mobile, and ally apps.
 */

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

/** Convenience aliases for table row types */
export type UserRow = Database['public']['Tables']['users']['Row'];
export type ScreenshotRow = Database['public']['Tables']['screenshots']['Row'];
export type AlertRow = Database['public']['Tables']['alerts']['Row'];
export type BlockedAttemptRow = Database['public']['Tables']['blocked_attempts']['Row'];
export type StreakRow = Database['public']['Tables']['streaks']['Row'];
