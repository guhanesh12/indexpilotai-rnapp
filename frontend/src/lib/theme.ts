import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
    card: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
  };
  border: {
    default: string;
    focus: string;
    profit: string;
    loss: string;
  };
  brand: {
    primary: string;
    accent: string;
  };
  trading: {
    profit: string;
    loss: string;
    warning: string;
  };
  status: {
    verified: string;
    gold: string;
  };
}

const darkColors = {
  bg: {
    primary: '#0A0A0B',
    secondary: '#16161A',
    tertiary: '#1C1C22',
    surface: '#111827',
    card: '#111827',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#8A8A93',
    disabled: '#45454B',
    inverse: '#0A0A0B',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(255, 255, 255, 0.3)',
    profit: 'rgba(0, 255, 102, 0.2)',
    loss: 'rgba(255, 51, 68, 0.2)',
  },
  brand: {
    primary: '#00BFFF',
    accent: '#FFB800',
  },
  trading: {
    profit: '#00FF66',
    loss: '#FF3344',
    warning: '#FFB800',
  },
  status: {
    verified: '#34D399',
    gold: '#F4B400',
  },
};

const lightColors = {
  bg: {
    primary: '#FAFAFA',
    secondary: '#F0F0F4',
    tertiary: '#E5E5EC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
    inverse: '#FAFAFA',
  },
  border: {
    default: 'rgba(0, 0, 0, 0.08)',
    focus: 'rgba(0, 0, 0, 0.3)',
    profit: 'rgba(0, 255, 102, 0.15)',
    loss: 'rgba(255, 51, 68, 0.15)',
  },
  brand: {
    primary: '#00BFFF',
    accent: '#FFB800',
  },
  trading: {
    profit: '#00CC44',
    loss: '#E53E3E',
    warning: '#FFB800',
  },
  status: {
    verified: '#34D399',
    gold: '#F4B400',
  },
};

export const colors = darkColors;

export const themes: Record<ThemeMode, Theme> = {
  dark: { mode: 'dark', ...darkColors },
  light: { mode: 'light', ...lightColors },
};

export const getSystemThemeMode = (): ThemeMode => {
  try {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  huge: 48,
};

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 100 };

export const typography = {
  h1: { fontSize: 40, lineHeight: 48, letterSpacing: -1, fontWeight: '800' as const },
  h2: { fontSize: 28, lineHeight: 36, letterSpacing: -0.5, fontWeight: '700' as const },
  h3: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3, fontWeight: '600' as const },
  h4: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums' as const],
  },
  mono: { fontVariant: ['tabular-nums' as const] },
};

export const TAB_COLORS = {
  home: '#00FFE0',
  symbols: '#FF9500',
  broker: '#7C5CFF',
  positions: '#FFB800',
  journal: '#00FF66',
  support: '#00B4FF',
  logs: '#888888',
  notifications: '#FFD600',
  profile: '#FF6EB4',
};

export const SECTION_COLORS = {
  home: TAB_COLORS.home,
  symbols: TAB_COLORS.symbols,
  broker: TAB_COLORS.broker,
  journal: TAB_COLORS.journal,
  profile: TAB_COLORS.profile,
  notifications: TAB_COLORS.notifications,
  login: '#EC4899',
  register: '#8B5CF6',
};
