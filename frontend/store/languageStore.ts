import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { translations, SupportedLanguage, LANGUAGES } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = '@mentova_language';

// Detect if we're on web
const isWeb = Platform.OS === 'web';

// Get initial language synchronously on web
const getInitialLanguage = (): SupportedLanguage => {
  if (isWeb && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && LANGUAGES.find(l => l.code === stored)) {
      console.log('[LanguageStore] Initial language from localStorage:', stored);
      return stored as SupportedLanguage;
    }
  }
  return 'en'; // Default to English (matches t() fallback, avoids SSR mismatch)
};

// Web localStorage fallback - synchronous for web
const getStoredLanguage = async (): Promise<string | null> => {
  try {
    if (isWeb && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const lang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      console.log('[LanguageStore] Web - Retrieved language from localStorage:', lang);
      return lang;
    }
    const lang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    console.log('[LanguageStore] Native - Retrieved language from AsyncStorage:', lang);
    return lang;
  } catch (error) {
    console.error('[LanguageStore] Error getting stored language:', error);
    return null;
  }
};

const setStoredLanguage = async (lang: string): Promise<void> => {
  try {
    if (isWeb && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      console.log('[LanguageStore] Web - Saved language to localStorage:', lang);
    }
    // Also save to AsyncStorage for consistency
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    console.log('[LanguageStore] Saved language to AsyncStorage:', lang);
  } catch (error) {
    console.error('[LanguageStore] Error saving language:', error);
  }
};

interface LanguageState {
  language: SupportedLanguage;
  isLoaded: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  loadLanguage: () => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: getInitialLanguage(), // Use synchronous initial value
  isLoaded: isWeb, // Already loaded on web since we read synchronously
  
  setLanguage: async (lang: SupportedLanguage) => {
    try {
      await setStoredLanguage(lang);
      set({ language: lang });
      console.log('[LanguageStore] Language set to:', lang);
    } catch (error) {
      console.error('[LanguageStore] Error saving language:', error);
    }
  },
  
  loadLanguage: async () => {
    try {
      const savedLang = await getStoredLanguage();
      console.log('Loaded saved language:', savedLang);
      if (savedLang && LANGUAGES.find(l => l.code === savedLang)) {
        set({ language: savedLang as SupportedLanguage, isLoaded: true });
      } else {
        // Default to French for new users
        const defaultLang: SupportedLanguage = 'en';
        await setStoredLanguage(defaultLang);
        set({ language: defaultLang, isLoaded: true });
      }
    } catch (error) {
      console.error('Error loading language:', error);
      set({ language: 'en', isLoaded: true });
    }
  },
  
  // Translation function with parameter support
  t: (key: string, params?: Record<string, string>) => {
    const { language } = get();
    const raw = translations[language]?.[key] || translations['en']?.[key] || key;
    // Safety: always return a string, never an object
    let text = typeof raw === 'string' ? raw : String(raw ?? key);
    
    // Replace parameters like {name} with actual values
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
      });
    }
    
    return text;
  },
}));

// Hook for easy translation access
export const useTranslation = () => {
  const { t, language, setLanguage, loadLanguage, isLoaded } = useLanguageStore();
  return { t, language, setLanguage, loadLanguage, isLoaded, languages: LANGUAGES };
};
