/**
 * Ascension design tokens.
 * Extracted from desktop/app/globals.css.
 * Reference apps: Oura Ring (dashboard), Calm (onboarding), Strava (activity feed).
 *
 * All values are React Native compatible (numbers for spacing, no CSS units).
 */

export const theme = {
  colors: {
    primary: '#223D8C',
    primaryHover: '#273E88',
    secondary: '#111111',
    accent: '#314A9F',
    accentHover: '#273E88',
    accentLight: '#EEF2FF',
    background: '#FCFCFD',
    surface: '#FFFFFF',
    card: '#fffffffe',
    foreground: '#111111',
    textPrimary: '#111111',
    cardText: '#000000',
    textSecondary: '#5F636E',
    inputSecondaryText: '#4D4D4D',
    muted: '#8B9099',
    border: '#D9DDE5',
    cardBorder: '#D9DDE5',
    success: '#16A34A',
    successLight: '#F0FDF4',
    warning: '#D97706',
    warningLight: '#FFF7ED',
    danger: '#DC2626',
    dangerLight: '#FEF2F2',
    infoBorderSoft: '#D8E1FF',
    error: '#DC2626',
    warmBg: '#F6F7FB',
    onAccent: '#FFFFFF',
    onPrimary: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.08)',
    intro:'#4D4D4D',
    backgroundCard:'#F0F4FF',
    white:'#FFFFFF',
    devider:'#E1E4ED',
    settings:'#F8FAFF',
    baseColor:'#8A8A8A',
    message:'#000000B2',
    borderColor:'#F0F2FA',
    black:'#000000',
    badgeColor:'#AEC3FF',
    gapBorder:'#496BCE'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    tl:20,
    '2xl': 48,
    '3xl': 64,
    tp:44
  },
  fontSize: {
    caption: 13,
    body: 16,
    bodyLg: 18,
    button: 18,
    h3: 20,
    h2: 28,
    h1: 36,
     largeText:44,
    header:24,
    display: 64,
    iconSm: 18,
    iconMd: 20,
    iconLg: 22,
    iconXl: 48,
    cardText:32,
   
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    caption: 18,
    body: 24,
    bodyLg: 28,
    button: 24,
    sm:36,
    h3: 26,
    h2: 34,
    h1: 43,
  },
  borderRadius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
    card: 24,
    button: 999,
    pill: 24,
    circle: 9999,
  },
  shadow: {
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
    strong: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 10,
    },
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
  },
  typography: {
    headingFamily: 'Afacad Flux',
    bodyFamily: 'Afacad Flux',
    phosphateSolid:'Phosphate-Solid'
  },
  components: {
    input: {
      height: 58,
      borderWidth: 1,
    },
    button: {
      height: 58,
    },
    backButton: {
      size: 48,
      iconSize: 22,
    },
  },
  fontFamily: 'Afacad Flux',
} as const;

export type Theme = typeof theme;
