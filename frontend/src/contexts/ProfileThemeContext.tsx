import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeMode, themes } from '../lib/theme';
import { ThemeContext } from './ThemeContext';

const THEME_STORAGE_KEY = 'kilo_profile_theme_mode';

interface ProfileThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

const ProfileThemeContext = createContext<ProfileThemeContextValue | undefined>(undefined);

export const useProfileTheme = (): ProfileThemeContextValue => {
  const context = useContext(ProfileThemeContext);
  if (!context) {
    return {
      theme: themes.light,
      themeMode: 'light',
      setThemeMode: () => {},
      toggleTheme: () => {},
      isDark: false,
      isLight: true,
    };
  }
  return context;
};

export const ProfileThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((e) =>
      console.warn('[ProfileTheme] Failed to persist theme mode:', e)
    );
  };

  const toggleTheme = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setThemeModeState(saved);
          return;
        }
      } catch (e) {
        console.warn('[ProfileTheme] Failed to load saved theme:', e);
      }
      setThemeModeState('light');
    };
    loadTheme();
  }, []);

  const value: ProfileThemeContextValue = {
    theme: themes[themeMode],
    themeMode,
    setThemeMode,
    toggleTheme,
    isDark: themeMode === 'dark',
    isLight: themeMode === 'light',
  };

  return (
    <ProfileThemeContext.Provider value={value}>
      <ThemeContext.Provider
        value={{
          theme: themes[themeMode],
          themeMode,
          setThemeMode,
          toggleTheme,
          isDark: themeMode === 'dark',
          isLight: themeMode === 'light',
        }}
      >
        {children}
      </ThemeContext.Provider>
    </ProfileThemeContext.Provider>
  );
};
