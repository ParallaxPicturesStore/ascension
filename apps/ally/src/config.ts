// ============================================================
// Ascension Ally - Environment Configuration
// ============================================================

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  functionsBaseUrl: process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL,
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
