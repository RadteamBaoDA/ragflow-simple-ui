// File: SettingsContext.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings, Theme, SUPPORTED_LANGUAGES } from '@/app/contexts/SettingsContext';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        language: 'en',
        changeLanguage: mockChangeLanguage,
      },
    }),
  };
});

vi.mock('antd', () => ({
  ConfigProvider: ({ children }: any) => <div data-testid="config-provider">{children}</div>,
  theme: {
    darkAlgorithm: 'dark',
    defaultAlgorithm: 'default',
  },
}));

const TestComponent = () => {
  const settings = useSettings();
  return (
    <div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="language">{settings.language}</div>
      <div data-testid="isDarkMode">{settings.isDarkMode.toString()}</div>
      <div data-testid="resolvedTheme">{settings.resolvedTheme}</div>
      <div data-testid="isSettingsOpen">{settings.isSettingsOpen.toString()}</div>
      <button onClick={() => settings.setTheme('dark')}>Set Dark</button>
      <button onClick={() => settings.setTheme('light')}>Set Light</button>
      <button onClick={() => settings.setTheme('system')}>Set System</button>
      <button onClick={() => settings.setLanguage('vi')}>Set Vietnamese</button>
      <button onClick={() => settings.setLanguage('ja')}>Set Japanese</button>
      <button onClick={() => settings.setLanguage('en')}>Set English</button>
      <button onClick={settings.openSettings}>Open Settings</button>
      <button onClick={settings.closeSettings}>Close Settings</button>
    </div>
  );
};

describe('SettingsContext', () => {
  let localStorageMock: { [key: string]: string };
  let matchMediaMock: any;

  beforeEach(() => {
    localStorageMock = {};
    const mockStorage = {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });

    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)' ? false : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    global.matchMedia = matchMediaMock;

    document.documentElement.className = '';
    mockChangeLanguage.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider', () => {
    it('renders without crashing', () => {
      render(
        <SettingsProvider>
          <div>Test</div>
        </SettingsProvider>
      );
    });

    it('wraps children in ConfigProvider', () => {
      render(
        <SettingsProvider>
          <div>Test</div>
        </SettingsProvider>
      );
      expect(screen.getByTestId('config-provider')).toBeInTheDocument();
    });
  });

  describe('useSettings hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleError.mockRestore();
    });

    it('provides default values', () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('language')).toHaveTextContent('en');
      expect(screen.getByTestId('isSettingsOpen')).toHaveTextContent('false');
    });
  });

  describe('Theme management', () => {
    it('sets theme to dark', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Dark'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
        expect(screen.getByTestId('isDarkMode')).toHaveTextContent('true');
        expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
      });
    });

    it('sets theme to light', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Light'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('light');
        expect(screen.getByTestId('isDarkMode')).toHaveTextContent('false');
        expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
      });
    });

    it('sets theme to system', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set System'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
      });
    });

    it('persists theme to localStorage', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Dark'));

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('kb-theme', 'dark');
      });
    });

    it('loads stored theme from localStorage', () => {
      localStorageMock['kb-theme'] = 'dark';

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('applies dark class to document when dark mode', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Dark'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('removes dark class when light mode', async () => {
      document.documentElement.classList.add('dark');

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Light'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('resolves system theme to dark when system prefers dark', () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      global.matchMedia = matchMediaMock;

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
    });

    it('resolves system theme to light when system prefers light', () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' ? false : true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      global.matchMedia = matchMediaMock;

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    });

    it('listens for system theme changes when theme is system', () => {
      const addEventListener = vi.fn();
      matchMediaMock.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      global.matchMedia = matchMediaMock;

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('handles invalid theme from localStorage', () => {
      localStorageMock['kb-theme'] = 'invalid';

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });
  });

  describe('Language management', () => {
    it('sets language to Vietnamese', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Vietnamese'));

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('vi');
      });
    });

    it('sets language to Japanese', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Japanese'));

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('ja');
      });
    });

    it('sets language to English', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set English'));

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('en');
      });
    });

    it('persists language to localStorage', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Vietnamese'));

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('kb-language', 'vi');
      });
    });

    it('loads stored language from localStorage', () => {
      localStorageMock['kb-language'] = 'ja';

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('ja');
    });

    it('calls i18n.changeLanguage when language changes', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Set Vietnamese'));

      await waitFor(() => {
        expect(mockChangeLanguage).toHaveBeenCalledWith('vi');
      });
    });

    it('handles invalid language from localStorage', () => {
      localStorageMock['kb-language'] = 'invalid';

      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('en');
    });
  });

  describe('Settings dialog', () => {
    it('opens settings dialog', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Open Settings'));

      await waitFor(() => {
        expect(screen.getByTestId('isSettingsOpen')).toHaveTextContent('true');
      });
    });

    it('closes settings dialog', async () => {
      render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>
      );

      fireEvent.click(screen.getByText('Open Settings'));
      await waitFor(() => {
        expect(screen.getByTestId('isSettingsOpen')).toHaveTextContent('true');
      });

      fireEvent.click(screen.getByText('Close Settings'));

      await waitFor(() => {
        expect(screen.getByTestId('isSettingsOpen')).toHaveTextContent('false');
      });
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('has 3 supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(3);
    });

    it('includes English', () => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === 'en');
      expect(lang).toBeDefined();
      expect(lang?.name).toBe('English');
      expect(lang?.nativeName).toBe('English');
      expect(lang?.flag).toBe('🇺🇸');
    });

    it('includes Vietnamese', () => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === 'vi');
      expect(lang).toBeDefined();
      expect(lang?.name).toBe('Vietnamese');
      expect(lang?.nativeName).toBe('Tiếng Việt');
      expect(lang?.flag).toBe('🇻🇳');
    });

    it('includes Japanese', () => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === 'ja');
      expect(lang).toBeDefined();
      expect(lang?.name).toBe('Japanese');
      expect(lang?.nativeName).toBe('日本語');
      expect(lang?.flag).toBe('🇯🇵');
    });
  });
});
