import { useState, useCallback, useRef } from 'react';
import { useLanguageStore } from '../store/languageStore';
import { Platform } from 'react-native';

const API_URL = Platform.OS === 'web'
  ? process.env.EXPO_PUBLIC_BACKEND_URL || ''
  : process.env.EXPO_PUBLIC_BACKEND_URL || '';

// In-memory cache to avoid repeated API calls
const translationCache: Record<string, Record<string, string>> = {};

function getCacheKey(texts: Record<string, string>, lang: string): string {
  const sorted = Object.entries(texts).sort(([a], [b]) => a.localeCompare(b));
  return `${JSON.stringify(sorted)}_${lang}`;
}

export function useContentTranslation() {
  const { language } = useLanguageStore();
  const [isTranslating, setIsTranslating] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const translateContent = useCallback(async (
    texts: Record<string, string>,
    sourceLang: string = 'fr'
  ): Promise<Record<string, string>> => {
    // No translation needed if same language
    if (language === sourceLang) {
      return texts;
    }

    // Filter out empty values
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(texts)) {
      if (v && v.trim()) filtered[k] = v;
    }
    if (Object.keys(filtered).length === 0) return texts;

    // Check in-memory cache
    const cacheKey = getCacheKey(filtered, language);
    if (translationCache[cacheKey]) {
      return { ...texts, ...translationCache[cacheKey] };
    }

    // Prevent duplicate calls
    if (pendingRef.current.has(cacheKey)) {
      return texts;
    }
    pendingRef.current.add(cacheKey);

    setIsTranslating(true);
    try {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: filtered,
          target_lang: language,
          source_lang: sourceLang,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          translationCache[cacheKey] = result.data;
          return { ...texts, ...result.data };
        }
      }
      return texts;
    } catch {
      return texts;
    } finally {
      setIsTranslating(false);
      pendingRef.current.delete(cacheKey);
    }
  }, [language]);

  return { translateContent, isTranslating, language };
}
