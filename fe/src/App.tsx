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

import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './contexts/SettingsContext';
import { RagflowProvider } from './contexts/RagflowContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import RoleRoute from './components/RoleRoute';
import SettingsDialog from './components/SettingsDialog';
import Layout from './components/Layout';
import { config } from './config';

// ============================================================================
// Lazy-loaded Pages (Code Splitting)
// ============================================================================

/** AI Chat page - embeds RAGFlow chat interface */
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
/** AI Search page - embeds RAGFlow search interface */
const AiSearchPage = lazy(() => import('./pages/AiSearchPage'));
/** Chat history page - view and manage past conversations */
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
/** Login page - Azure AD / root authentication */
const LoginPage = lazy(() => import('./pages/LoginPage'));
/** Logout page - handles session cleanup */
const LogoutPage = lazy(() => import('./pages/LogoutPage'));
/** User management page - admin only */
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
/** System monitoring tools page - admin only */
const SystemToolsPage = lazy(() => import('./pages/SystemToolsPage'));
/** System Monitor page - admin only */
const SystemMonitorPage = lazy(() => import('./pages/SystemMonitorPage'));
/** Error display page - 403, 404, 500 errors */
const ErrorPage = lazy(() => import('./pages/ErrorPage'));
/** MinIO storage manager - admin/manager only */
const MinIOManagerPage = lazy(() => import('./pages/MinIOManagerPage'));
/** Audit log viewer - admin only */
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
/** Tokenizer tool - admin only */
const TokenizerPage = lazy(() => import('./pages/TokenizerPage'));
/** Storage Dashboard - admin only */
const StoragePage = lazy(() => import('./pages/StoragePage'));
/** RAGFlow Config page - admin only */
const RagflowConfigPage = lazy(() => import('./pages/RagflowConfigPage'));

// Initialize i18n for internationalization
import './i18n';

// ============================================================================
// Loading Component
// ============================================================================

/**
 * Full-page loading spinner shown during lazy loading.
 * Displays a spinning circle in the center of the screen.
 */
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

// ============================================================================
// Main App Component
// ============================================================================

/**
 * Main application component.
 * 
 * Provides:
 * - Authentication context (AuthProvider)
 * - Settings context for theme/language (SettingsProvider)
 * - RAGFlow configuration context (RagflowProvider)
 * - Route definitions with protection layers
 */
function App() {
  /**
   * Determines the default redirect path based on enabled features.
   * Prioritizes: AI Chat > AI Search > History > fallback to AI Chat
   */
  const getDefaultPath = () => {
    if (config.features.enableAiChat) return '/ai-chat';
    if (config.features.enableAiSearch) return '/ai-search';
    if (config.features.enableHistory) return '/history';
    return '/ai-chat'; // fallback
  };

  return (
    <AuthProvider>
      <SettingsProvider>
        <RagflowProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/logout" element={<LogoutPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Navigate to={getDefaultPath()} replace />} />

                {config.features.enableAiChat && (
                  <Route path="/ai-chat" element={<AiChatPage />} />
                )}

                {config.features.enableAiSearch && (
                  <Route path="/ai-search" element={<AiSearchPage />} />
                )}

                {config.features.enableHistory && (
                  <Route path="/history" element={<HistoryPage />} />
                )}

                <Route path="/user-management" element={
                  <AdminRoute>
                    <UserManagementPage />
                  </AdminRoute>
                } />
                <Route path="/system-tools" element={
                  <AdminRoute>
                    <SystemToolsPage />
                  </AdminRoute>
                } />
                <Route path="/system-monitor" element={
                  <AdminRoute>
                    <SystemMonitorPage />
                  </AdminRoute>
                } />
                <Route path="/storage" element={
                  <RoleRoute allowedRoles={['admin', 'manager']}>
                    <MinIOManagerPage />
                  </RoleRoute>
                } />
                <Route path="/audit-log" element={
                  <AdminRoute>
                    <AuditLogPage />
                  </AdminRoute>
                } />
                <Route path="/tokenizer" element={
                  <AdminRoute>
                    <TokenizerPage />
                  </AdminRoute>
                } />
                <Route path="/storage-dashboard" element={
                  <AdminRoute>
                    <StoragePage />
                  </AdminRoute>
                } />
                <Route path="/ragflow-config" element={
                  <AdminRoute>
                    <RagflowConfigPage />
                  </AdminRoute>
                } />

                {/* Error routes */}
                <Route path="/403" element={<ErrorPage code={403} />} />
                <Route path="/404" element={<ErrorPage code={404} />} />
                <Route path="/500" element={<ErrorPage code={500} />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Routes>
          </Suspense>
          <SettingsDialog />
        </RagflowProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
