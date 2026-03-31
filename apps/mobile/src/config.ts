export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_KEY || '',
};
