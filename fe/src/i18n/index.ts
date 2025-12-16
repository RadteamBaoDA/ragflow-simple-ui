/**
 * @fileoverview Internationalization (i18n) configuration.
 * 
 * Sets up i18next for multi-language support with:
 * - Automatic browser language detection
 * - localStorage persistence for language preference
 * - Three supported languages: English, Vietnamese, Japanese
 * 
 * @module i18n
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import vi from './locales/vi.json';
import ja from './locales/ja.json';

// ============================================================================
// Language Configuration
// ============================================================================

/**
 * Supported languages with metadata for UI display.
 * Each language includes:
 * - code: ISO 639-1 language code
 * - name: English name
 * - nativeName: Name in native language
 * - flag: Emoji flag for visual identification
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
] as const;

/** Type for valid language codes */
export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

/**
 * Translation resources keyed by language code.
 * Each language maps to its translation namespace.
 */
const resources = {
  en: { translation: en },
  vi: { translation: vi },
  ja: { translation: ja },
};

// ============================================================================
// i18n Initialization
// ============================================================================

i18n
  // Detect user language from browser/localStorage
  .use(LanguageDetector)
  // Integrate with React
  .use(initReactI18next)
  // Initialize with configuration
  .init({
    resources,
    fallbackLng: 'en', // Fallback to English if translation missing
    supportedLngs: ['en', 'vi', 'ja'],
    interpolation: {
      escapeValue: false, // React already escapes values (XSS safe)
    },
    detection: {
      order: ['localStorage', 'navigator'], // Check localStorage first, then browser
      caches: ['localStorage'], // Persist selection to localStorage
      lookupLocalStorage: 'kb-language', // Custom storage key
    },
  });

export default i18n;
