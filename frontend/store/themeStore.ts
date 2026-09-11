import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryGlow: string;
  inputBg: string;
}

const DARK: ThemeColors = {
  bg: '#06060F',
  bgSecondary: '#0A0A1A',
  surface: '#120E26',
  surfaceHover: 'rgba(124,58,237,0.1)',
  border: 'rgba(124,58,237,0.12)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#7C3AED',
  primaryGlow: 'rgba(124,58,237,0.08)',
  inputBg: '#120E26',
};

const LIGHT: ThemeColors = {
  bg: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  surface: '#F1F5F9',
  surfaceHover: 'rgba(124,58,237,0.06)',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#7C3AED',
  primaryGlow: 'rgba(124,58,237,0.06)',
  inputBg: '#F1F5F9',
};

export const THEMES: Record<ThemeMode, ThemeColors> = { dark: DARK, light: LIGHT };

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  colors: DARK,
  toggleTheme: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: next, colors: THEMES[next] });
    AsyncStorage.setItem('mentova_theme', next).catch(() => {});
  },
  setTheme: (mode: ThemeMode) => {
    set({ mode, colors: THEMES[mode] });
    AsyncStorage.setItem('mentova_theme', mode).catch(() => {});
  },
  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem('mentova_theme');
      if (saved === 'light' || saved === 'dark') {
        set({ mode: saved, colors: THEMES[saved] });
      }
    } catch {}
  },
}));
