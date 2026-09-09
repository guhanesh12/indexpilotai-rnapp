import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeMode, themes, getSystemThemeMode } from '../lib/theme';

const THEME_STORAGE_KEY = 'kilo_theme_mode';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export { ThemeContext };

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    const fallbackMode = getSystemThemeMode();
    return {
      theme: themes[fallbackMode],
      themeMode: fallbackMode,
      setThemeMode: () => {},
      toggleTheme: () => {},
      isDark: fallbackMode === 'dark',
      isLight: fallbackMode === 'light',
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: ReactNode; defaultMode?: ThemeMode }> = ({
  children,
  defaultMode,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((e) =>
      console.warn('[Theme] Failed to persist theme mode:', e)
    );
  };

  const toggleTheme = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const loadTheme = async () => {
      if (defaultMode) {
        setThemeModeState(defaultMode);
        return;
      }
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setThemeModeState(saved);
          return;
        }
      } catch (e) {
        console.warn('[Theme] Failed to load saved theme:', e);
      }
      const systemMode = getSystemThemeMode();
      setThemeModeState(systemMode);
    };
    loadTheme();
  }, [defaultMode]);

  useEffect(() => {
    if (!defaultMode) {
      const sub = Appearance.addChangeListener(({ colorScheme }) => {
        if (colorScheme) {
          setThemeMode(colorScheme === 'light' ? 'light' : 'dark');
        }
      });
      return () => sub.remove();
    }
  }, [defaultMode]);

  const value: ThemeContextValue = {
    theme: themes[themeMode],
    themeMode,
    setThemeMode,
    toggleTheme,
    isDark: themeMode === 'dark',
    isLight: themeMode === 'light',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
