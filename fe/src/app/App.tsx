/**
 * @fileoverview Main application component with routing configuration.
 *
 * This module defines the application's route structure, including:
 * - Public routes (login, logout)
 * - Protected routes requiring authentication
 * - Admin-only routes (user management, system tools)
 * - Role-based routes (storage for admin/manager)
 *
 * Uses React Router for navigation and lazy loading for code splitting.
 *
 * @module App
 */

import { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { AuthProvider, ProtectedRoute, AdminRoute, RoleRoute } from '@/features/auth';
import { SettingsProvider } from '@/app/contexts/SettingsContext';
import { KnowledgeBaseProvider } from '@/features/knowledge-base';
import SettingsDialog from '@/components/SettingsDialog';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import Layout from '@/layouts/MainLayout';
import { config } from '@/config';
import { NavigationProvider } from '@/components/NavigationLoader';
import { HeaderActionsProvider } from '@/components/HeaderActions';
import '@/i18n';
import icon from '@/assets/icon.png';
import { GuidelineProvider } from '@/features/guideline';
// ============================================================================
// Lazy-loaded Pages (Code Splitting)
// ============================================================================

const AiChatPage = lazy(() => import('@/features/ai/pages/AiChatPage'));
const AiSearchPage = lazy(() => import('@/features/ai/pages/AiSearchPage'));
const HistoryPage = lazy(() => import('@/features/history/pages/HistoryPage'));
const ChatHistoryPage = lazy(() => import('@/features/history/pages/ChatHistoryPage'));
const SearchHistoryPage = lazy(() => import('@/features/history/pages/SearchHistoryPage'));
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const LogoutPage = lazy(() => import('@/features/auth/pages/LogoutPage'));
const UserManagementPage = lazy(() => import('@/features/users/pages/UserManagementPage'));
const TeamManagementPage = lazy(() => import('@/features/teams/pages/TeamManagementPage'));
const SystemToolsPage = lazy(() => import('@/features/system/pages/SystemToolsPage'));
const SystemMonitorPage = lazy(() => import('@/features/system/pages/SystemMonitorPage'));
const ErrorPage = lazy(() => import('@/components/ErrorPage'));
const AuditLogPage = lazy(() => import('@/features/audit/pages/AuditLogPage'));
const TokenizerPage = lazy(() => import('@/features/ai/pages/TokenizerPage'));
const KnowledgeBaseConfigPage = lazy(() => import('@/features/knowledge-base/pages/KnowledgeBaseConfigPage'));
const BroadcastMessagePage = lazy(() => import('@/features/broadcast/pages/BroadcastMessagePage'));

const HistoriesPage = lazy(() => import('@/features/histories/pages/HistoriesPage'));

const GlossaryPage = lazy(() => import('@/features/glossary/pages/GlossaryPage'));

const RagflowServersPage = lazy(() => import('@/features/ragflow-servers/pages/RagflowServersPage'));
const ProjectListPage = lazy(() => import('@/features/projects/pages/ProjectListPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'));
const AdminDashboardPage = lazy(() => import('@/features/dashboard/pages/AdminDashboardPage'));


// ============================================================================
// Loading Component (for initial app load / login page)
// ============================================================================

/**
 * Full-screen loader shown during initial app load or non-layout routes.
 * Layout pages use their own ContentLoader inside the layout.
 */
const PageLoader = () => (
  <div data-suspense-fallback="true" className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

// ============================================================================
// Server Error Overlay (502 / 503 / 504)
// ============================================================================

/**
 * Full-screen overlay shown when the server returns a gateway error (502/503/504).
 * Listens for the `server:gateway-error` custom event dispatched by api.ts.
 * Renders over the preloader, stopping the spinner and showing a clear message.
 */
const ServerErrorBanner = () => {
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const handleGatewayError = useCallback((e: Event) => {
    const detail = (e as CustomEvent<{ status: number }>).detail;
    setErrorStatus(detail.status);
  }, []);

  useEffect(() => {
    window.addEventListener('server:gateway-error', handleGatewayError);
    return () => window.removeEventListener('server:gateway-error', handleGatewayError);
  }, [handleGatewayError]);

  if (!errorStatus) return null;

  const statusMessages: Record<number, string> = {
    502: 'Bad Gateway — the server is not responding.',
    503: 'Service Unavailable — the server is temporarily down.',
    504: 'Gateway Timeout — the server took too long to respond.',
  };
  const message = statusMessages[errorStatus] ?? `Server error (${errorStatus}).`;

  return (
    <div
      role="alert"
      style={{ zIndex: 99999 }}
      className="fixed inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center gap-6 text-center mx-4">
        {/* Status badge */}
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <span className="text-3xl font-bold text-red-600 dark:text-red-400">{errorStatus}</span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Server Unavailable</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Please wait a moment, then try again.
          </p>
        </div>

        <button
          onClick={() => { setErrorStatus(null); window.location.reload(); }}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Global Notification Bridge
// ============================================================================

import { message as antdMessage } from 'antd';
let messageApi: any = null;

// Bridge Ant Design message API so non-component code (mutations) can surface notifications
export const globalMessage = {
  success: (content: string) => {
    if (messageApi) messageApi.success(content);
    else antdMessage.success(content);
  },
  error: (content: string) => {
    if (messageApi) messageApi.error(content);
    else antdMessage.error(content);
  },
  info: (content: string) => {
    if (messageApi) messageApi.info(content);
    else antdMessage.info(content);
  },
  warning: (content: string) => {
    if (messageApi) messageApi.warning(content);
    else antdMessage.warning(content);
  }
};

const GlobalNotifications = () => {
  const { message } = AntdApp.useApp();
  messageApi = message;
  return null;
};

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  /**
   * Set the icon of the app
   */
  useEffect(() => {
    let link: HTMLLinkElement = document.querySelector('link[rel~="icon"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = icon;
  }, []);

  const getDefaultPath = () => {
    if (config.features.enableAiChat) return '/chat';
    if (config.features.enableAiSearch) return '/search';
    if (config.features.enableHistory) return '/history';
    return '/chat';
  };

  return (
    <AntdApp>
      <ServerErrorBanner />
      <GlobalNotifications />
      <AuthProvider>
        <SettingsProvider>
          <KnowledgeBaseProvider>
            <GuidelineProvider>
              <ConfirmProvider>
                <HeaderActionsProvider>
                  <NavigationProvider>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* ... routes ... */}
                        {/* Public routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/logout" element={<LogoutPage />} />

                        {/* Protected routes */}
                        <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                          <Route element={<Layout />}>
                            <Route index element={<Navigate to={getDefaultPath()} replace />} />

                            {/* Chat routes */}
                            {config.features.enableAiChat && (
                              <Route path="chat" element={<AiChatPage />} />
                            )}
                            {config.features.enableAiChat && config.features.enableHistory && (
                              <Route path="chat/history" element={<ChatHistoryPage />} />
                            )}

                            {/* Search routes */}
                            {config.features.enableAiSearch && (
                              <Route path="search" element={<AiSearchPage />} />
                            )}
                            {config.features.enableAiSearch && config.features.enableHistory && (
                              <Route path="search/history" element={<SearchHistoryPage />} />
                            )}

                            {config.features.enableHistory && (
                              <Route path="history" element={<HistoryPage />} />
                            )}

                            {/* Knowledge Base routes */}
                            <Route path="knowledge-base/config" element={
                              <AdminRoute>
                                <KnowledgeBaseConfigPage />
                              </AdminRoute>
                            } />

                            <Route path="knowledge-base/glossary" element={
                              <RoleRoute allowedRoles={['admin', 'leader']}>
                                <GlossaryPage />
                              </RoleRoute>
                            } />

                            {/* IAM routes */}
                            <Route path="iam/users" element={
                              <AdminRoute>
                                <UserManagementPage />
                              </AdminRoute>
                            } />

                            <Route path="iam/teams" element={
                              <AdminRoute>
                                <TeamManagementPage />
                              </AdminRoute>
                            } />

                            {/* Admin routes */}
                            <Route path="admin/audit-log" element={
                              <AdminRoute>
                                <AuditLogPage />
                              </AdminRoute>
                            } />
                            <Route path="admin/system-tools" element={
                              <AdminRoute>
                                <SystemToolsPage />
                              </AdminRoute>
                            } />
                            <Route path="admin/system-monitor" element={
                              <AdminRoute>
                                <SystemMonitorPage />
                              </AdminRoute>
                            } />
                            <Route path="admin/tokenizer" element={
                              <AdminRoute>
                                <TokenizerPage />
                              </AdminRoute>
                            } />
                            <Route path="admin/broadcast-messages" element={
                              <AdminRoute>
                                <BroadcastMessagePage />
                              </AdminRoute>
                            } />

                            <Route path="admin/histories" element={
                              <AdminRoute>
                                <HistoriesPage />
                              </AdminRoute>
                            } />

                            {/* RAGFlow Management routes */}
                            <Route path="admin/ragflow-servers" element={
                              <AdminRoute>
                                <RagflowServersPage />
                              </AdminRoute>
                            } />
                            <Route path="knowledge-base/projects" element={
                              <RoleRoute allowedRoles={['admin', 'leader']}>
                                <ProjectListPage />
                              </RoleRoute>
                            } />
                            <Route path="knowledge-base/projects/:projectId" element={
                              <RoleRoute allowedRoles={['admin', 'leader']}>
                                <ProjectDetailPage />
                              </RoleRoute>
                            } />
                            <Route path="admin/dashboard" element={
                              <AdminRoute>
                                <AdminDashboardPage />
                              </AdminRoute>
                            } />
                          </Route>
                        </Route>

                        {/* Error routes */}
                        <Route path="/403" element={<ErrorPage code={403} />} />
                        <Route path="/404" element={<ErrorPage code={404} />} />
                        <Route path="/500" element={<ErrorPage code={500} />} />
                        <Route path="*" element={<Navigate to="/404" replace />} />
                      </Routes>
                    </Suspense>
                    <SettingsDialog />
                  </NavigationProvider>
                </HeaderActionsProvider>
              </ConfirmProvider>
            </GuidelineProvider>
          </KnowledgeBaseProvider>
        </SettingsProvider>
      </AuthProvider>
    </AntdApp>
  );
}

export default App;
