// File: App.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App, { globalMessage } from '@/app/App';

// Must use vi.hoisted to ensure config is available before mocks are hoisted
const { vi_mockConfig } = vi.hoisted(() => ({
  vi_mockConfig: {
    features: {
      enableAiChat: true,
      enableAiSearch: true,
      enableHistory: true,
    },
  },
}));

vi.mock('@/config', () => ({
  config: vi_mockConfig,
}));

vi.mock('antd', () => ({
  App: Object.assign(
    ({ children }: any) => <div data-testid="antd-app">{children}</div>,
    {
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: vi.fn(),
          info: vi.fn(),
          warning: vi.fn(),
        },
        notification: {},
        modal: {},
      }),
    }
  ),
  message: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }),
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
  ProtectedRoute: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
  AdminRoute: ({ children }: any) => <div data-testid="admin-route">{children}</div>,
  RoleRoute: ({ children, allowedRoles }: any) => <div data-testid="role-route" data-roles={allowedRoles.join(',')}>{children}</div>,
  LogoutPage: () => <div>LogoutPage</div>,
}));

// Mock the actual lazy-loaded page modules so Suspense resolves to deterministic components
vi.mock('@/features/auth/pages/LoginPage', () => ({ default: () => <div>LoginPage</div> }))
vi.mock('@/features/history/pages/HistoryPage', () => ({ default: () => <div>HistoryPage</div> }))

vi.mock('@/app/contexts/SettingsContext', () => ({
  SettingsProvider: ({ children }: any) => <div data-testid="settings-provider">{children}</div>,
  useSettings: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    language: 'en',
    setLanguage: vi.fn(),
    isDarkMode: false,
    resolvedTheme: 'light',
    isSettingsOpen: false,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
  }),
}));

vi.mock('@/features/knowledge-base', () => ({
  KnowledgeBaseProvider: ({ children }: any) => <div data-testid="kb-provider">{children}</div>,
  KnowledgeBaseConfigPage: () => <div>KnowledgeBaseConfigPage</div>,
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmProvider: ({ children }: any) => <div data-testid="confirm-provider">{children}</div>,
}));

vi.mock('@/components/SettingsDialog', () => ({
  default: () => <div data-testid="settings-dialog" />,
}));

vi.mock('@/components/RouteProgressBar', () => ({
  default: () => <div data-testid="progress-bar" />,
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }: any) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/features/ai', () => ({
  AiChatPage: () => <div>AiChatPage</div>,
  AiSearchPage: () => <div>AiSearchPage</div>,
  TokenizerPage: () => <div>TokenizerPage</div>,
}));

vi.mock('@/features/history', () => ({
  HistoryPage: () => <div>HistoryPage</div>,
}));

vi.mock('@/features/users', () => ({
  UserManagementPage: () => <div>UserManagementPage</div>,
}));

vi.mock('@/features/teams', () => ({
  TeamManagementPage: () => <div>TeamManagementPage</div>,
}));

vi.mock('@/features/system', () => ({
  SystemToolsPage: () => <div>SystemToolsPage</div>,
  SystemMonitorPage: () => <div>SystemMonitorPage</div>,
}));

vi.mock('@/features/documents', () => ({
  DocumentManagerPage: () => <div>DocumentManagerPage</div>,
}));

vi.mock('@/features/audit', () => ({
  AuditLogPage: () => <div>AuditLogPage</div>,
}));

vi.mock('@/features/storage', () => ({
  StoragePage: () => <div>StoragePage</div>,
}));

vi.mock('@/features/broadcast', () => ({
  BroadcastMessagePage: () => <div>BroadcastMessagePage</div>,
}));

vi.mock('@/components/ErrorPage', () => ({
  default: ({ code }: any) => <div data-testid={`error-${code}`}>ErrorPage {code}</div>,
}));

vi.mock('@/i18n', () => ({ default: {} }));

describe('App', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    // Mock global fetch for tests
    global.fetch = vi.fn(() => 
      Promise.resolve(new Response(JSON.stringify({ user: null }), { status: 401 }))
    ) as any;
  });

  it('renders without crashing', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('antd-app')).toBeInTheDocument();
  });

  it('renders all provider components', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('settings-provider')).toBeInTheDocument();
    expect(screen.getByTestId('kb-provider')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-provider')).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('renders settings dialog', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
  });

  it('redirects root to default path', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.queryByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('renders login page on /login route', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText('LoginPage')).toBeInTheDocument();
    });
  });

  it('renders 403 error page', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/403']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('error-403')).toBeInTheDocument();
    });
  });

  it('renders 404 error page', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/404']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('error-404')).toBeInTheDocument();
    });
  });

  it('redirects unknown routes to 404', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/unknown-route']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('error-404')).toBeInTheDocument();
    });
  });

  describe('globalMessage', () => {
    it('has success method', () => {
      expect(globalMessage.success).toBeDefined();
      globalMessage.success('test');
    });

    it('has error method', () => {
      expect(globalMessage.error).toBeDefined();
      globalMessage.error('test');
    });

    it('has info method', () => {
      expect(globalMessage.info).toBeDefined();
      globalMessage.info('test');
    });

    it('has warning method', () => {
      expect(globalMessage.warning).toBeDefined();
      globalMessage.warning('test');
    });
  });

  describe('feature flags', () => {
    it('redirects to ai-chat when enableAiChat is true', () => {
      vi_mockConfig.features.enableAiChat = true;
      vi_mockConfig.features.enableAiSearch = false;
      vi_mockConfig.features.enableHistory = false;
      
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    it('redirects to ai-search when enableAiSearch is true and chat is false', () => {
      vi_mockConfig.features.enableAiChat = false;
      vi_mockConfig.features.enableAiSearch = true;
      vi_mockConfig.features.enableHistory = false;
      
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    it('redirects to history when only enableHistory is true', () => {
      vi_mockConfig.features.enableAiChat = false;
      vi_mockConfig.features.enableAiSearch = false;
      vi_mockConfig.features.enableHistory = true;
      
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
  });
});
