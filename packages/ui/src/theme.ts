/**
 * Ascension design tokens.
 * Extracted from desktop/app/globals.css.
 * Reference apps: Oura Ring (dashboard), Calm (onboarding), Strava (activity feed).
 *
 * All values are React Native compatible (numbers for spacing, no CSS units).
 */

export const theme = {
  colors: {
    background: '#faf9f7',
    foreground: '#1a1a1a',
    card: '#ffffff',
    cardBorder: '#e8e5e0',
    accent: '#1a3a5c',
    accentHover: '#142e4a',
    accentLight: '#edf3f8',
    warmBg: '#f3f1ed',
    muted: '#6b6560',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  fontSize: {
    caption: 13,
    body: 15,
    bodyLg: 17,
    h3: 20,
    h2: 24,
    h1: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
  },
  borderRadius: {
    card: 8,
    button: 12,
    pill: 24,
    circle: 9999,
  },
  shadow: {
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  fontFamily: 'DM Sans',
} as const;

export type Theme = typeof theme;
