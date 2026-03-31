// ============================================================
// Ascension Mobile - Environment Configuration
// ============================================================

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_KEY ?? '',
} as const;

/**
 * Validate that required environment variables are set.
 * Call this early in app startup.
 */
export function validateConfig(): void {
  if (!config.supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  }
  if (!config.supabaseAnonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
  }
}
