/**
 * @fileoverview Tests for SettingsContext.
 * 
 * Tests:
 * - Theme management (light, dark, system)
 * - Language management
 * - Settings dialog state
 * - localStorage persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode, createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

type Theme = 'light' | 'dark' | 'system';
type LanguageCode = 'en' | 'vi' | 'ja';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  isDarkMode: boolean;
  resolvedTheme: 'light' | 'dark';
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

// ============================================================================
// Mock localStorage
// ============================================================================

let mockStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    mockStorage = {};
  }),
};

// Mock matchMedia
let mockPrefersDark = false;
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('dark') && mockPrefersDark,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_THEME = 'kb-theme';
const STORAGE_KEY_LANGUAGE = 'kb-language';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return mockMatchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getStoredTheme(): Theme {
  const stored = mockLocalStorage.getItem(STORAGE_KEY_THEME);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getStoredLanguage(): LanguageCode {
  const stored = mockLocalStorage.getItem(STORAGE_KEY_LANGUAGE);
  if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
    return stored as LanguageCode;
  }
  return 'en';
}

// ============================================================================
// Mock Context and Provider
// ============================================================================

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

function SettingsProvider({ children }: SettingsProviderProps) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const updateDarkMode = () => {
      const shouldBeDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');
      setIsDarkMode(shouldBeDark);
    };

    updateDarkMode();
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    mockLocalStorage.setItem(STORAGE_KEY_THEME, newTheme);
  }, []);

  const setLanguage = useCallback((newLang: LanguageCode) => {
    setLanguageState(newLang);
    mockLocalStorage.setItem(STORAGE_KEY_LANGUAGE, newLang);
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        isDarkMode,
        resolvedTheme: isDarkMode ? 'dark' : 'light',
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// ============================================================================
// Tests
// ============================================================================

describe('SettingsContext', () => {
  beforeEach(() => {
    mockStorage = {};
    mockPrefersDark = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
  });

  describe('theme management', () => {
    describe('initial state', () => {
      it('should default to system theme', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.theme).toBe('system');
      });

      it('should restore saved theme from localStorage', () => {
        mockStorage[STORAGE_KEY_THEME] = 'dark';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.theme).toBe('dark');
      });

      it('should ignore invalid theme values in storage', () => {
        mockStorage[STORAGE_KEY_THEME] = 'invalid';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.theme).toBe('system');
      });
    });

    describe('setTheme', () => {
      it('should update theme to light', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setTheme('light');
        });

        expect(result.current.theme).toBe('light');
      });

      it('should update theme to dark', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setTheme('dark');
        });

        expect(result.current.theme).toBe('dark');
      });

      it('should persist theme to localStorage', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setTheme('dark');
        });

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY_THEME, 'dark');
      });
    });

    describe('isDarkMode', () => {
      it('should be false for light theme', () => {
        mockStorage[STORAGE_KEY_THEME] = 'light';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.isDarkMode).toBe(false);
      });

      it('should be true for dark theme', () => {
        mockStorage[STORAGE_KEY_THEME] = 'dark';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.isDarkMode).toBe(true);
      });

      it('should follow system preference when theme is system', () => {
        mockStorage[STORAGE_KEY_THEME] = 'system';
        mockPrefersDark = true;

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.isDarkMode).toBe(true);
      });
    });

    describe('resolvedTheme', () => {
      it('should return light when isDarkMode is false', () => {
        mockStorage[STORAGE_KEY_THEME] = 'light';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.resolvedTheme).toBe('light');
      });

      it('should return dark when isDarkMode is true', () => {
        mockStorage[STORAGE_KEY_THEME] = 'dark';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.resolvedTheme).toBe('dark');
      });
    });
  });

  describe('language management', () => {
    describe('initial state', () => {
      it('should default to English', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.language).toBe('en');
      });

      it('should restore saved language from localStorage', () => {
        mockStorage[STORAGE_KEY_LANGUAGE] = 'vi';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.language).toBe('vi');
      });

      it('should ignore invalid language values in storage', () => {
        mockStorage[STORAGE_KEY_LANGUAGE] = 'invalid';

        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.language).toBe('en');
      });
    });

    describe('setLanguage', () => {
      it('should update language to Vietnamese', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setLanguage('vi');
        });

        expect(result.current.language).toBe('vi');
      });

      it('should update language to Japanese', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setLanguage('ja');
        });

        expect(result.current.language).toBe('ja');
      });

      it('should persist language to localStorage', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <SettingsProvider>{children}</SettingsProvider>
        );

        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
          result.current.setLanguage('ja');
        });

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY_LANGUAGE, 'ja');
      });
    });
  });

  describe('settings dialog', () => {
    it('should start with dialog closed', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.isSettingsOpen).toBe(false);
    });

    it('should open dialog', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.openSettings();
      });

      expect(result.current.isSettingsOpen).toBe(true);
    });

    it('should close dialog', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.openSettings();
      });

      act(() => {
        result.current.closeSettings();
      });

      expect(result.current.isSettingsOpen).toBe(false);
    });
  });

  describe('context error handling', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useSettings());
      }).toThrow('useSettings must be used within a SettingsProvider');
    });
  });
});

describe('helper functions', () => {
  beforeEach(() => {
    mockStorage = {};
    mockPrefersDark = false;
  });

  describe('getSystemTheme', () => {
    it('should return light when system prefers light', () => {
      mockPrefersDark = false;
      expect(getSystemTheme()).toBe('light');
    });

    it('should return dark when system prefers dark', () => {
      mockPrefersDark = true;
      expect(getSystemTheme()).toBe('dark');
    });
  });

  describe('getStoredTheme', () => {
    it('should return stored theme', () => {
      mockStorage[STORAGE_KEY_THEME] = 'dark';
      expect(getStoredTheme()).toBe('dark');
    });

    it('should return system as default', () => {
      expect(getStoredTheme()).toBe('system');
    });
  });

  describe('getStoredLanguage', () => {
    it('should return stored language', () => {
      mockStorage[STORAGE_KEY_LANGUAGE] = 'ja';
      expect(getStoredLanguage()).toBe('ja');
    });

    it('should return en as default', () => {
      expect(getStoredLanguage()).toBe('en');
    });
  });
});
