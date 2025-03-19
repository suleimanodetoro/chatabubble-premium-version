import { createContext, useContext } from 'react';
import { TextStyle } from 'react-native';

// Design tokens
export const colors = {
  // Primary palette
  primary: {
    main: '#4A6FFF',
    light: '#7A95FF',
    dark: '#3D56CC',
    contrast: '#FFFFFF',
  },
  secondary: {
    main: '#FF6B6B',
    light: '#FF9797',
    dark: '#D45555',
    contrast: '#FFFFFF',
  },
  tertiary: {
    main: '#6CD9A3',
    light: '#92E7BB',
    dark: '#51B082',
    contrast: '#FFFFFF',
  },
  
  // Neutral palette
  background: {
    default: '#F8FAFC',
    paper: '#FFFFFF',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    disabled: '#94A3B8',
    hint: '#94A3B8',
  },
  
  // Semantic colors
  success: {
    main: '#22C55E',
    light: '#4ADE80',
    dark: '#16A34A',
    contrast: '#FFFFFF',
  },
  warning: {
    main: '#FBBF24',
    light: '#FCD34D',
    dark: '#F59E0B',
    contrast: '#1E293B',
  },
  error: {
    main: '#EF4444',
    light: '#F87171',
    dark: '#DC2626',
    contrast: '#FFFFFF',
  },
  info: {
    main: '#3B82F6',
    light: '#60A5FA',
    dark: '#2563EB',
    contrast: '#FFFFFF',
  },
  
  // UI specific
  divider: '#E2E8F0',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

// Spacing system (based on 4pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  
  // Convenience shortcuts
  get: (multiplier = 1) => multiplier * 4,
};

// Border radius system
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Typography system
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 32,
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 40,
};

// Typography styles
export const typography: Record<string, TextStyle> = {
  display: {
    fontSize: fontSizes.display,
    lineHeight: lineHeights.xxl,
    fontWeight: fontWeights.bold,
  },
  h1: {
    fontSize: fontSizes.xxl,
    lineHeight: lineHeights.xl,
    fontWeight: fontWeights.bold,
  },
  h2: {
    fontSize: fontSizes.xl,
    lineHeight: lineHeights.lg,
    fontWeight: fontWeights.semibold,
  },
  h3: {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.semibold,
  },
  body1: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.regular,
  },
  body2: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: fontWeights.regular,
  },
  caption: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: fontWeights.regular,
  },
  button: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.medium,
  },
};

// Shadow styles
export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Animation timing
export const animation = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
};

// Complete theme object (now including fontSizes)
export const theme = {
  colors,
  spacing,
  radius,
  typography,
  fontSizes,
  fontWeights,
  shadows,
  animation,
};

// Theme context
type ThemeContextType = typeof theme;
export const ThemeContext = createContext<ThemeContextType>(theme);

// Theme provider hook
export const useTheme = () => useContext(ThemeContext);
