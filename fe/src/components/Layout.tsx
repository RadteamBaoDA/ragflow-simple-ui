/**
 * @fileoverview Main application layout component with sidebar navigation.
 * 
 * Provides the overall app structure including:
 * - Collapsible sidebar with navigation links
 * - User profile display with avatar
 * - Settings and logout actions
 * - Main content area with header and dynamic page titles
 * - RAGFlow source selection dropdowns
 * - Full i18n support for navigation and page titles
 * 
 * Uses feature flags from config to conditionally render navigation items.
 * Supports both light and dark themes.
 * 
 * @module components/Layout
 */

import { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useRagflow } from '../contexts/RagflowContext';
import { config } from '../config';
import { Select } from './Select';
import {
  MessageSquare,
  Search,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Server,
  HardDrive,
  ClipboardList,
  FileCode,
  Database
} from 'lucide-react';
import logo from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';

// ============================================================================
// Sub-components
// ============================================================================

/**
 * User avatar component with image or initials fallback.
 * 
 * Displays user's avatar image if available, otherwise shows
 * the first two initials of their display name.
 * 
 * @param user - User object containing avatar and displayName
 * @param size - Avatar size: 'sm' (32px) or 'md' (40px)
 */
function UserAvatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' }) {
  // Size classes for avatar dimensions
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';

  // Render image avatar if available
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName}
        className={`${sizeClasses} rounded-full object-cover`}
      />
    );
  }

  // Generate initials from display name (max 2 characters)
  const initials = user.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Render fallback initials avatar
  return (
    <div className={`${sizeClasses} rounded-full bg-slate-600 dark:bg-slate-700 flex items-center justify-center text-white font-medium`}>
      {initials}
    </div>
  );
}

// ============================================================================
// Main Layout Component
// ============================================================================

/**
 * Main application layout with sidebar navigation and content area.
 * 
 * Features:
 * - Collapsible sidebar with role-based navigation
 * - Dynamic page titles based on current route
 * - RAGFlow source selection dropdowns (when multiple sources available)
 * - User profile section with settings and logout
 * - Theme-aware styling (light/dark mode)
 */
function Layout() {
  const { t } = useTranslation();
  const location = useLocation();

  // State: Sidebar collapse toggle
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get auth, settings, and RAGFlow context
  const { user } = useAuth();
  const { openSettings, resolvedTheme } = useSettings();
  const ragflow = useRagflow();

  // Select logo based on current theme
  // Select logo based on current theme
  const logoSrc = resolvedTheme === 'dark' ? logoDark : logo;

  /**
   * Get page title based on current route.
   * Falls back to app name for unknown routes.
   */
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/ai-chat':
        return t('pages.aiChat.title');
      case '/ai-search':
        return t('pages.aiSearch.title');
      case '/history':
        return t('pages.history.title');
      case '/system-tools':
        return t('pages.systemTools.title');
      case '/storage':
        return t('pages.storage.title');
      case '/user-management':
        return t('userManagement.title');
      case '/audit-log':
        return t('pages.auditLog.title');
      case '/tokenizer':
        return t('pages.tokenizer.title');
      case '/storage-dashboard':
        return t('storage.title');
      default:
        return t('common.appName');
    }
  };

  // Determine if source selection dropdowns should be shown
  // Only show when multiple sources are configured
  const showChatDropdown = location.pathname === '/ai-chat' && ragflow.config?.chatSources && ragflow.config.chatSources.length > 1;
  const showSearchDropdown = location.pathname === '/ai-search' && ragflow.config?.searchSources && ragflow.config.searchSources.length > 1;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar-bg dark:bg-slate-950 text-sidebar-text flex flex-col transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-white/10 ${resolvedTheme === 'dark' ? '' : 'bg-white'}`}>
          {!isCollapsed && (
            <div className="flex items-center justify-start w-full transition-all duration-300">
              <img
                src={logoSrc}
                alt="Knowledge Base"
                className="w-48 object-contain object-left"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg transition-colors ml-2 flex-shrink-0 ${resolvedTheme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
            title={isCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1 mt-4">
          {config.features.enableAiChat && (
            <NavLink to="/ai-chat" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.aiChat')}>
              <MessageSquare size={20} />
              {!isCollapsed && <span>{t('nav.aiChat')}</span>}
            </NavLink>
          )}
          {config.features.enableAiSearch && (
            <NavLink to="/ai-search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.aiSearch')}>
              <Search size={20} />
              {!isCollapsed && <span>{t('nav.aiSearch')}</span>}
            </NavLink>
          )}
          {config.features.enableHistory && (
            <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.history')}>
              <History size={20} />
              {!isCollapsed && <span>{t('nav.history')}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/user-management" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.userManagement')}>
              <Users size={20} />
              {!isCollapsed && <span>{t('nav.userManagement')}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/system-tools" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.systemTools')}>
              <Server size={20} />
              {!isCollapsed && <span>{t('nav.systemTools')}</span>}
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/storage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.storage')}>
              <HardDrive size={20} />
              {!isCollapsed && <span>{t('nav.storage')}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/audit-log" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.auditLog')}>
              <ClipboardList size={20} />
              {!isCollapsed && <span>{t('nav.auditLog')}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/tokenizer" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.tokenizer')}>
              <FileCode size={20} />
              {!isCollapsed && <span>{t('nav.tokenizer')}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/storage-dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('storage.title')}>
              <Database size={20} />
              {!isCollapsed && <span>{t('storage.title')}</span>}
            </NavLink>
          )}
        </nav>

        <div className={`mt-auto pt-4 border-t border-white/10 space-y-3 pb-4 ${resolvedTheme === 'dark' ? '' : 'bg-white'}`}>
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'}`} title={isCollapsed ? user.displayName : undefined}>
              <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{user.displayName}</div>
                  <div className={`text-xs truncate ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{user.email}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={openSettings} className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''} ${resolvedTheme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`} title={t('common.settings')}>
            <Settings size={20} />
            {!isCollapsed && <span>{t('common.settings')}</span>}
          </button>
          <Link to="/logout" className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''} ${resolvedTheme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`} title={t('nav.signOut')}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('nav.signOut')}</span>}
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 h-16 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{getPageTitle()}</h1>

          <div id="header-actions" className="flex items-center gap-2 ml-auto"></div>

          {showChatDropdown && (
            <Select
              value={ragflow.selectedChatSourceId}
              onChange={ragflow.setSelectedChatSource}
              options={ragflow.config?.chatSources || []}
              icon={<MessageSquare size={18} />}
            />
          )}

          {showSearchDropdown && (
            <Select
              value={ragflow.selectedSearchSourceId}
              onChange={ragflow.setSelectedSearchSource}
              options={ragflow.config?.searchSources || []}
              icon={<Search size={18} />}
            />
          )}
        </header>
        <div className={`flex-1 overflow-hidden ${['/ai-chat', '/ai-search', '/storage', '/system-tools', '/storage-dashboard'].includes(location.pathname) ? '' : 'p-8 overflow-auto'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
