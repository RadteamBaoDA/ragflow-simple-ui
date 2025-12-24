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
import { AuthProvider } from '@/features/auth';
import { SettingsProvider } from '@/app/contexts/SettingsContext';
import { KnowledgeBaseProvider } from '@/features/knowledge-base';
import { ProtectedRoute, AdminRoute, RoleRoute } from '@/features/auth';
import SettingsDialog from '@/components/SettingsDialog';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import Layout from '@/layouts/MainLayout';
import { config } from '@/config';
import RouteProgressBar from '@/components/RouteProgressBar';
import '@/i18n';

// ============================================================================
// Lazy-loaded Pages (Code Splitting)
// ============================================================================

const AiChatPage = lazy(() => import('@/features/ai').then(m => ({ default: m.AiChatPage })));
const AiSearchPage = lazy(() => import('@/features/ai').then(m => ({ default: m.AiSearchPage })));
const HistoryPage = lazy(() => import('@/features/history').then(m => ({ default: m.HistoryPage })));
const LoginPage = lazy(() => import('@/features/auth').then(m => ({ default: m.LoginPage })));
const LogoutPage = lazy(() => import('@/features/auth').then(m => ({ default: m.LogoutPage })));
const UserManagementPage = lazy(() => import('@/features/users').then(m => ({ default: m.UserManagementPage })));
const TeamManagementPage = lazy(() => import('@/features/teams').then(m => ({ default: m.TeamManagementPage })));
const SystemToolsPage = lazy(() => import('@/features/system').then(m => ({ default: m.SystemToolsPage })));
const SystemMonitorPage = lazy(() => import('@/features/system').then(m => ({ default: m.SystemMonitorPage })));
const ErrorPage = lazy(() => import('@/components/ErrorPage'));
const DocumentManagerPage = lazy(() => import('@/features/documents').then(m => ({ default: m.DocumentManagerPage })));
const AuditLogPage = lazy(() => import('@/features/audit').then(m => ({ default: m.AuditLogPage })));
const TokenizerPage = lazy(() => import('@/features/ai').then(m => ({ default: m.TokenizerPage })));
const StoragePage = lazy(() => import('@/features/storage').then(m => ({ default: m.StoragePage })));
const KnowledgeBaseConfigPage = lazy(() => import('@/features/knowledge-base').then(m => ({ default: m.KnowledgeBaseConfigPage })));
const BroadcastMessagePage = lazy(() => import('@/features/broadcast').then(m => ({ default: m.BroadcastMessagePage })));

// ============================================================================
// Loading Component
// ============================================================================

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

// ============================================================================
// Main App Component
// ============================================================================

import { App as AntApp } from 'antd';

function App() {

  const getDefaultPath = () => {
    if (config.features.enableAiChat) return '/ai-chat';
    if (config.features.enableAiSearch) return '/ai-search';
    if (config.features.enableHistory) return '/history';
    return '/ai-chat'; // fallback
  };

  return (
    <AntApp>
      <AuthProvider>
        <SettingsProvider>
          <KnowledgeBaseProvider>
            <ConfirmProvider>
              <RouteProgressBar />
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
                    <Route path="/documents" element={
                      <RoleRoute allowedRoles={['admin', 'leader']}>
                        <DocumentManagerPage />
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
                    <Route path="/knowledge-base/config" element={
                      <AdminRoute>
                        <KnowledgeBaseConfigPage />
                      </AdminRoute>
                    } />
                    <Route path="/iam/teams" element={
                      <AdminRoute>
                        <TeamManagementPage />
                      </AdminRoute>
                    } />
                    <Route path="/broadcast-messages" element={
                      <AdminRoute>
                        <BroadcastMessagePage />
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
            </ConfirmProvider>
          </KnowledgeBaseProvider>
        </SettingsProvider>
      </AuthProvider>
    </AntApp>
  );
}

export default App;
