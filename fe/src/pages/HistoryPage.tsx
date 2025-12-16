/**
 * @fileoverview Chat history page component with i18n support.
 * 
 * Displays user's chat session history with:
 * - Full-text search across messages
 * - Date range filtering
 * - Bulk selection and deletion
 * - Individual session deletion
 * - All text internationalized via i18next
 * 
 * Uses React Query for data fetching and mutations.
 * 
 * @module pages/HistoryPage
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { Dialog } from '../components/Dialog';
import { Checkbox } from '../components/Checkbox';

// ============================================================================
// Types
// ============================================================================

/** Chat session with messages */
interface ChatSession {
  /** Unique session identifier */
  id: string;
  /** Session title (usually first message summary) */
  title: string;
  /** ISO timestamp when session was created */
  createdAt: string;
  /** ISO timestamp when session was last updated */
  updatedAt: string;
  /** Array of messages in the session */
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

/** Search results with pagination info */
interface SearchResult {
  sessions: ChatSession[];
  total: number;
}

/** Search query parameters */
interface SearchParams {
  q?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search chat sessions with filters.
 * 
 * @param params - Search parameters (query, dates, pagination)
 * @returns Search results with sessions and total count
 */
async function searchChatSessions(params: SearchParams): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  return apiFetch<SearchResult>(`/api/chat/sessions/search?${searchParams.toString()}`);
}

/**
 * Delete a single chat session.
 * 
 * @param sessionId - ID of session to delete
 */
async function deleteChatSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * Delete multiple chat sessions.
 * 
 * @param sessionIds - Array of session IDs to delete
 * @returns Count of deleted sessions
 */
async function deleteChatSessions(sessionIds: string[]): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>('/api/chat/sessions', {
    method: 'DELETE',
    body: JSON.stringify({ sessionIds }),
  });
}

/**
 * Delete all sessions for the current user.
 * 
 * @returns Count of deleted sessions
 */
async function deleteAllSessions(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>('/api/chat/sessions', {
    method: 'DELETE',
    body: JSON.stringify({ all: true }),
  });
}

// ============================================================================
// Component
// ============================================================================

/**
 * Chat history page with search, filtering, and bulk actions.
 * 
 * Features:
 * - Full-text search across message content
 * - Date range filtering (start/end dates)
 * - Select all / individual selection
 * - Bulk delete with confirmation
 * - Delete all with confirmation
 * - Localized date formatting
 */
function HistoryPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Selection state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Get locale for date formatting based on current language
  const dateLocale = i18n.language === 'vi' ? 'vi-VN' : i18n.language === 'ja' ? 'ja-JP' : 'en-US';

  const searchParams: SearchParams = {
    q: searchQuery || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 50,
  };

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['chatSessions', searchParams],
    queryFn: () => searchChatSessions(searchParams),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteChatSessions,
    onSuccess: () => {
      setSelectedSessions(new Set());
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllSessions,
    onSuccess: () => {
      setSelectedSessions(new Set());
      setDeleteAllConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleSelectAll = () => {
    if (!result?.sessions) return;

    if (selectedSessions.size === result.sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(result.sessions.map(s => s.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedSessions.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedSessions));
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAll = () => {
    deleteAllMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-500 dark:text-slate-400">
        {t('history.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg">
        {t('history.errorLoading')}: {error instanceof Error ? error.message : t('common.error')}
      </div>
    );
  }

  const sessions = result?.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('history.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder={t('history.startDate')}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder={t('history.endDate')}
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
              >
                🔍 {t('history.search')}
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn-secondary"
              >
                {t('history.clear')}
              </button>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('history.sessionsFound', { count: result?.total ?? 0 })}
            </span>
          </div>
        </form>
      </div>

      {/* Bulk Actions */}
      {sessions.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={selectedSessions.size === sessions.length && sessions.length > 0}
              onChange={toggleSelectAll}
              label={t('history.selectAll')}
            />
            {selectedSessions.size > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('history.selected', { count: selectedSessions.size })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedSessions.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn bg-red-500 text-white hover:bg-red-600"
                disabled={bulkDeleteMutation.isPending}
              >
                🗑️ {t('history.deleteSelected', { count: selectedSessions.size })}
              </button>
            )}
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="btn bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              🗑️ {t('history.deleteAll')}
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="flex justify-center items-center h-48 text-slate-500 dark:text-slate-400">
          {searchQuery || startDate || endDate
            ? t('history.noMatchingResults')
            : t('history.noHistory')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-white dark:bg-slate-800 border rounded-lg p-6 transition-all ${selectedSessions.has(session.id)
                  ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:shadow-lg'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <Checkbox
                    checked={selectedSessions.has(session.id)}
                    onChange={() => toggleSessionSelection(session.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">{session.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(session.updatedAt).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                      {t('history.messageCount', { count: session.messages.length })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(session.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title={t('history.deleteSession')}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('history.confirmDelete')}
        footer={
          <>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="btn bg-red-500 text-white hover:bg-red-600"
            >
              {bulkDeleteMutation.isPending ? t('history.deleting') : t('common.delete')}
            </button>
          </>
        }
      >
        <p>{t('history.confirmDeleteMessage', { count: selectedSessions.size })}</p>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog
        open={deleteAllConfirm}
        onClose={() => setDeleteAllConfirm(false)}
        title={`⚠️ ${t('history.deleteAllTitle')}`}
        footer={
          <>
            <button
              onClick={() => setDeleteAllConfirm(false)}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
              className="btn bg-red-500 text-white hover:bg-red-600"
            >
              {deleteAllMutation.isPending ? t('history.deleting') : t('history.deleteAll')}
            </button>
          </>
        }
      >
        <p>{t('history.deleteAllMessage')}</p>
      </Dialog>
    </div>
  );
}

export default HistoryPage;
