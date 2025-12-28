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

import { useState, Suspense } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '@/features/auth';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useKnowledgeBase } from '@/features/knowledge-base';
import { config } from '../config';
import { Select } from '@/components/Select';
import {
  MessageSquare,
  Search,

  Settings,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,

  Server,
  HardDrive,
  ClipboardList,
  FileCode,
  Database,
  Settings2,
  Activity,
  Shield,
  ChevronDown,
  User as UserIcon,
  UserCog,
  Megaphone,
  History,
} from 'lucide-react';

import logo from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import BroadcastBanner from '@/features/broadcast/components/BroadcastBanner';

// ============================================================================
// Content Loading Component
// ============================================================================

/**
 * Loading indicator shown while lazy-loaded page content is loading.
 * Displayed inside the content area (not full-screen) so sidebar stays visible.
 */
const ContentLoader = () => (
  <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-slate-900">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
    </div>
  </div>
);

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
  const [isIamExpanded, setIsIamExpanded] = useState(false);
  const [isAdministratorsExpanded, setIsAdministratorsExpanded] = useState(false);
  const [isKnowledgeBaseExpanded, setIsKnowledgeBaseExpanded] = useState(false);

  // Get auth, settings, and Knowledge Base context
  const { user } = useAuth();
  const { openSettings, resolvedTheme } = useSettings();
  const knowledgeBase = useKnowledgeBase();

  // Select logo based on current theme
  // Select logo based on current theme
  const logoSrc = resolvedTheme === 'dark' ? logoDark : logo;

  /**
   * Get page title based on current route.
   * Falls back to app name for unknown routes.
   */
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/chat':
        return t('pages.aiChat.title');
      case '/chat/history':
        return t('pages.chatHistory.title');
      case '/search':
        return t('pages.aiSearch.title');
      case '/search/history':
        return t('pages.searchHistory.title');
      case '/history':
        return t('pages.history.title');
      case '/knowledge-base/documents':
        return t('pages.storage.title');
      case '/knowledge-base/config':
        return t('knowledgeBaseConfig.title');
      case '/knowledge-base/storage':
        return t('storage.title');
      case '/knowledge-base/prompts':
        return t('prompts.title');
      case '/iam/users':
        return t('userManagement.title');
      case '/iam/teams':
        return t('iam.teams.title');
      case '/admin/audit-log':
        return t('pages.auditLog.title');
      case '/admin/system-tools':
      case '/admin/system-monitor':
        return t('pages.systemMonitor.title');
      case '/admin/tokenizer':
        return t('pages.tokenizer.title');
      case '/admin/broadcast-messages':
        return t('admin.broadcastMessages');
      case '/admin/histories':
        return t('histories.title');
      default:
        return t('common.appName');
    }
  };

  // Auto-expand parent menus when their children are active
  const isKnowledgeBaseActive = ['/knowledge-base/documents', '/knowledge-base/config', '/knowledge-base/storage', '/knowledge-base/prompts'].includes(location.pathname);
  const isIamActive = ['/iam/users', '/iam/teams'].includes(location.pathname);
  const isAdministratorsActive = ['/admin/audit-log', '/admin/system-tools', '/admin/system-monitor', '/admin/tokenizer', '/admin/broadcast-messages', '/admin/histories'].includes(location.pathname);
  const isChatActive = ['/chat', '/chat/history'].includes(location.pathname);
  const isSearchActive = ['/search', '/search/history'].includes(location.pathname);

  // Combine manual toggle with auto-expand logic
  // Chat and Search menus only expand when their routes are active (auto-collapse when navigating away)
  const shouldExpandKnowledgeBase = isKnowledgeBaseExpanded || isKnowledgeBaseActive;
  const shouldExpandIam = isIamExpanded || isIamActive;
  const shouldExpandAdministrators = isAdministratorsExpanded || isAdministratorsActive;
  const shouldExpandChat = isChatActive;
  const shouldExpandSearch = isSearchActive;

  // Determine if source selection dropdowns should be shown
  // Only show when multiple sources are configured
  const showChatDropdown = location.pathname === '/chat' && knowledgeBase.config?.chatSources && knowledgeBase.config.chatSources.length > 1;
  const showSearchDropdown = location.pathname === '/search' && knowledgeBase.config?.searchSources && knowledgeBase.config.searchSources.length > 1;

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

        <nav className="flex flex-col gap-2 flex-1 mt-4 overflow-y-auto scrollbar-hide px-2">
          {config.features.enableAiChat && (
            <div className="flex flex-col gap-1">
              <NavLink
                to="/chat"
                className={({ isActive }: { isActive: boolean }) => `sidebar-link w-full ${isActive && !location.pathname.includes('history') ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={t('nav.aiChat')}
              >
                <MessageSquare size={20} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.aiChat')}</span>
                    {shouldExpandChat ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </NavLink>

              {(!isCollapsed && shouldExpandChat) && config.features.enableHistory && (
                <div className="pl-4 flex flex-col gap-1">
                  <NavLink to="/chat/history" className={({ isActive }: { isActive: boolean }) => `sidebar-link text-sm ${isActive ? 'active' : ''}`} title={t('nav.chatHistory')}>
                    <History size={16} />
                    <span>{t('nav.chatHistory')}</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {config.features.enableAiSearch && (
            <div className="flex flex-col gap-1">
              <NavLink
                to="/search"
                className={({ isActive }: { isActive: boolean }) => `sidebar-link w-full ${isActive && !location.pathname.includes('history') ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={t('nav.aiSearch')}
              >
                <Search size={20} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.aiSearch')}</span>
                    {shouldExpandSearch ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </NavLink>

              {(!isCollapsed && shouldExpandSearch) && config.features.enableHistory && (
                <div className="pl-4 flex flex-col gap-1">
                  <NavLink to="/search/history" className={({ isActive }: { isActive: boolean }) => `sidebar-link text-sm ${isActive ? 'active' : ''}`} title={t('nav.searchHistory')}>
                    <ClipboardList size={16} />
                    <span>{t('nav.searchHistory')}</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {(user?.role === 'admin' || user?.role === 'leader') && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setIsKnowledgeBaseExpanded(!isKnowledgeBaseExpanded)}
                className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={t('nav.knowledgeBase')}
              >
                <BookOpen size={20} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.knowledgeBase')}</span>
                    {shouldExpandKnowledgeBase ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </button>

              {(!isCollapsed && shouldExpandKnowledgeBase) && (
                <div className="pl-4 flex flex-col gap-1">
                  <NavLink to="/knowledge-base/documents" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.storage')}>
                    <HardDrive size={18} />
                    <span>{t('nav.storage')}</span>
                  </NavLink>
                  {user?.role === 'admin' && (
                    <NavLink to="/knowledge-base/config" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('knowledgeBaseConfig.title')}>
                      <Settings2 size={18} />
                      <span>{t('knowledgeBaseConfig.title')}</span>
                    </NavLink>
                  )}
                  {user?.role === 'admin' && (
                    <NavLink to="/knowledge-base/storage" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('storage.title')}>
                      <Database size={18} />

                      <span>{t('storage.title')}</span>
                    </NavLink>
                  )}
                  <NavLink to="/knowledge-base/prompts" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.prompts')}>
                    <BookOpen size={18} />
                    <span>{t('nav.prompts')}</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {/* {config.features.enableHistory && (
            <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.history')}>
              <History size={20} />
              {!isCollapsed && <span>{t('nav.history')}</span>}
            </NavLink>
          )} */}
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setIsIamExpanded(!isIamExpanded)}
                className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={t('nav.iam')}
              >
                <UserCog size={20} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.iam')}</span>
                    {shouldExpandIam ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </button>

              {(!isCollapsed && shouldExpandIam) && (
                <div className="pl-4 flex flex-col gap-1">
                  <NavLink to="/iam/users" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.userManagement')}>
                    <UserIcon size={18} />
                    <span>{t('nav.userManagement')}</span>
                  </NavLink>
                  <NavLink to="/iam/teams" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.teamManagement')}>
                    <Users size={18} />
                    <span>{t('nav.teamManagement')}</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setIsAdministratorsExpanded(!isAdministratorsExpanded)}
                className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={t('nav.administrators')}
              >
                <Shield size={20} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.administrators')}</span>
                    {shouldExpandAdministrators ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </button>

              {(!isCollapsed && shouldExpandAdministrators) && (
                <div className="pl-4 flex flex-col gap-1">
                  <NavLink to="/admin/audit-log" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.auditLog')}>
                    <ClipboardList size={18} />
                    <span>{t('nav.auditLog')}</span>
                  </NavLink>
                  <NavLink to="/admin/system-tools" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.systemTools')}>
                    <Server size={18} />
                    <span>{t('nav.systemTools')}</span>
                  </NavLink>
                  <NavLink to="/admin/system-monitor" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.systemMonitor')}>
                    <Activity size={18} />
                    <span>{t('nav.systemMonitor')}</span>
                  </NavLink>
                  <NavLink to="/admin/tokenizer" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.tokenizer')}>
                    <FileCode size={18} />
                    <span>{t('nav.tokenizer')}</span>
                  </NavLink>
                  <NavLink to="/admin/broadcast-messages" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.broadcastMessages')}>
                    <Megaphone size={18} />
                    <span>{t('nav.broadcastMessages')}</span>
                  </NavLink>
                  <NavLink to="/admin/histories" className={({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'active' : ''}`} title={t('nav.histories')}>
                    <History size={18} />
                    <span>{t('nav.histories')}</span>
                  </NavLink>

                </div>
              )}
            </div>
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
        <BroadcastBanner />
        {!['/chat/history', '/search/history', '/admin/system-monitor', '/admin/system-tools', '/admin/tokenizer'].includes(location.pathname) && (
          <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 h-16 flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{getPageTitle()}</h1>

            <div id="header-actions" className="flex items-center gap-2 ml-auto"></div>

            {showChatDropdown && (
              <Select
                value={knowledgeBase.selectedChatSourceId}
                onChange={knowledgeBase.setSelectedChatSource}
                options={knowledgeBase.config?.chatSources || []}
                icon={<MessageSquare size={18} />}
              />
            )}

            {showSearchDropdown && (
              <Select
                value={knowledgeBase.selectedSearchSourceId}
                onChange={knowledgeBase.setSelectedSearchSource}
                options={knowledgeBase.config?.searchSources || []}
                icon={<Search size={18} />}
              />
            )}
          </header>
        )}
        <div className={`flex-1 overflow-hidden ${['/chat', '/search', '/knowledge-base/documents', '/admin/system-tools', '/knowledge-base/storage', '/ragflow-config', '/iam/teams', '/admin/histories', '/chat/history', '/search/history'].includes(location.pathname) ? '' : 'p-8 overflow-auto'}`}>
          <Suspense fallback={<ContentLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default Layout;
