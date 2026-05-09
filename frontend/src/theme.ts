/**
 * VicinoMed Theme + Constants
 */
export const COLORS = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    primary: '#0A3D62',
    primaryFg: '#FFFFFF',
    secondary: '#00C48C',
    secondaryFg: '#FFFFFF',
    accent: '#E6F7F1',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#00C48C',
    error: '#EF4444',
    warning: '#F59E0B',
    whatsapp: '#25D366',
  },
  dark: {
    background: '#020617',
    surface: '#0F172A',
    surfaceAlt: '#1E293B',
    primary: '#00C48C',
    primaryFg: '#020617',
    secondary: '#0A3D62',
    secondaryFg: '#FFFFFF',
    accent: '#0B2A3F',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#1E293B',
    success: '#00C48C',
    error: '#F87171',
    warning: '#FBBF24',
    whatsapp: '#25D366',
  },
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const FONTS = {
  h1: 32, h2: 26, h3: 20, h4: 18,
  body: 15, small: 13, tiny: 11,
};

export type ThemeColors = typeof COLORS.light;
