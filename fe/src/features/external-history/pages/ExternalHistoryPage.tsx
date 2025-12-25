/**
 * @fileoverview External History page component.
 *
 * Displays external user's chat and search history.
 *
 * @module pages/ExternalHistoryPage
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

interface ExternalChatSession {
    id: string;
    session_id: string;
    user_prompt: string;
    llm_response: string;
    citations: any[];
    created_at: string;
}

interface ExternalSearchSession {
    id: string;
    search_input: string;
    ai_summary: string;
    file_results: any[];
    created_at: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchExternalChatHistory(search: string): Promise<ExternalChatSession[]> {
    return apiFetch<ExternalChatSession[]>(`/api/admin/history/chat?q=${encodeURIComponent(search)}`);
}

async function fetchExternalSearchHistory(search: string): Promise<ExternalSearchSession[]> {
    return apiFetch<ExternalSearchSession[]>(`/api/admin/history/search?q=${encodeURIComponent(search)}`);
}

async function fetchSystemChatHistory(search: string): Promise<any[]> {
    return apiFetch<any[]>(`/api/admin/history/system-chat?q=${encodeURIComponent(search)}`);
}

// ============================================================================
// Component
// ============================================================================

function ExternalHistoryPage() {
    useTranslation();
    const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'system'>('chat');
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: chatHistory, isLoading: isLoadingChat, refetch: refetchChat } = useQuery({
        queryKey: ['externalChatHistory', searchQuery],
        queryFn: () => fetchExternalChatHistory(searchQuery),
        enabled: activeTab === 'chat',
    });

    const { data: searchHistory, isLoading: isLoadingSearch, refetch: refetchSearch } = useQuery({
        queryKey: ['externalSearchHistory', searchQuery],
        queryFn: () => fetchExternalSearchHistory(searchQuery),
        enabled: activeTab === 'search',
    });

    const { data: systemHistory, isLoading: isLoadingSystem, refetch: refetchSystem } = useQuery({
        queryKey: ['systemChatHistory', searchQuery],
        queryFn: () => fetchSystemChatHistory(searchQuery),
        enabled: activeTab === 'system',
    });

    const isLoading = activeTab === 'chat' ? isLoadingChat : (activeTab === 'search' ? isLoadingSearch : isLoadingSystem);
    const historyData = activeTab === 'chat' ? chatHistory : (activeTab === 'search' ? searchHistory : systemHistory);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTab === 'chat') refetchChat();
        else if (activeTab === 'search') refetchSearch();
        else refetchSystem();
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            {/* Sidebar */}
            <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex space-x-2">
                        <button
                            className={`flex-1 py-2 rounded-lg ${activeTab === 'chat'
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            onClick={() => { setActiveTab('chat'); setSelectedItem(null); setSearchQuery(''); }}
                        >
                            Chat History
                        </button>
                        <button
                            className={`flex-1 py-2 rounded-lg ${activeTab === 'search'
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            onClick={() => { setActiveTab('search'); setSelectedItem(null); setSearchQuery(''); }}
                        >
                            Search History
                        </button>
                        <button
                            className={`flex-1 py-2 rounded-lg ${activeTab === 'system'
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            onClick={() => { setActiveTab('system'); setSelectedItem(null); setSearchQuery(''); }}
                        >
                            System Chat
                        </button>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search history..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                        <button type="submit" className="btn btn-primary px-3 py-2 text-sm">
                            Search
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center">Loading...</div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {historyData?.map((item: any) => (
                                <div
                                    key={item.id}
                                    className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                    onClick={() => setSelectedItem(item)}
                                >
                                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {activeTab === 'chat' ? (item.user_prompt.substring(0, 10) + (item.user_prompt.length > 10 ? '...' : '')) : (activeTab === 'search' ? item.search_input : item.title)}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                                        <span>{new Date(activeTab === 'system' ? item.updated_at : item.created_at).toLocaleString()}</span>
                                        {activeTab === 'system' && (
                                            <span className="text-xs text-blue-500 truncate ml-2 max-w-[100px]" title={item.user_email}>{item.user_email}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {selectedItem ? (
                    <div className="space-y-6">
                        {activeTab === 'chat' && (
                            <>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">User Prompt</h3>
                                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{(selectedItem as ExternalChatSession).user_prompt}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border-l-4 border-primary">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Assistant Response</h3>
                                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{(selectedItem as ExternalChatSession).llm_response}</p>
                                </div>
                                {(selectedItem as ExternalChatSession).citations && (selectedItem as ExternalChatSession).citations.length > 0 && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Citations</h3>
                                        <ul className="list-disc pl-5 space-y-1">
                                            {(selectedItem as ExternalChatSession).citations.map((citation: any, idx: number) => (
                                                <li key={idx} className="text-slate-900 dark:text-slate-100">{citation}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'search' && (
                            <>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Search Input</h3>
                                    <p className="text-slate-900 dark:text-slate-100">{(selectedItem as ExternalSearchSession).search_input}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">AI Summary</h3>
                                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{(selectedItem as ExternalSearchSession).ai_summary}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">File Results</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {(selectedItem as ExternalSearchSession).file_results?.map((file: any, idx: number) => (
                                            <li key={idx} className="text-slate-900 dark:text-slate-100">{typeof file === 'string' ? file : JSON.stringify(file)}</li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        )}
                        {activeTab === 'system' && (
                            <>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Session Info</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-slate-500">User</span>
                                            <div className="text-slate-900 dark:text-slate-100">{selectedItem.user_name} ({selectedItem.user_email})</div>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Created At</span>
                                            <div className="text-slate-900 dark:text-slate-100">{new Date(selectedItem.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Messages</h3>
                                    <div className="space-y-4">
                                        {selectedItem.messages?.map((msg: any) => (
                                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'}`}>
                                                    <div className="text-xs opacity-50 mb-1">{msg.role}</div>
                                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                        Select an item from the history to view details
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExternalHistoryPage;
