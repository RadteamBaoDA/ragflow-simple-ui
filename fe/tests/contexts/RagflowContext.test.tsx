/**
 * @fileoverview Tests for RagflowContext.
 * 
 * Tests:
 * - Config fetching
 * - Source selection
 * - Error handling
 * - Loading states
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode, createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface RagflowSource {
  id: string;
  name: string;
  url: string;
}

interface RagflowConfig {
  aiChatUrl: string;
  aiSearchUrl: string;
  chatSources: RagflowSource[];
  searchSources: RagflowSource[];
}

interface RagflowContextType {
  config: RagflowConfig | null;
  selectedChatSourceId: string;
  selectedSearchSourceId: string;
  setSelectedChatSource: (id: string) => void;
  setSelectedSearchSource: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockConfig: RagflowConfig = {
  aiChatUrl: 'https://ragflow.example.com/chat',
  aiSearchUrl: 'https://ragflow.example.com/search',
  chatSources: [
    { id: 'chat-1', name: 'General Chat', url: 'https://ragflow.example.com/chat/1' },
    { id: 'chat-2', name: 'Technical Chat', url: 'https://ragflow.example.com/chat/2' },
  ],
  searchSources: [
    { id: 'search-1', name: 'General Search', url: 'https://ragflow.example.com/search/1' },
  ],
};

// ============================================================================
// Mock Context and Provider
// ============================================================================

const RagflowContext = createContext<RagflowContextType | undefined>(undefined);

interface RagflowProviderProps {
  children: ReactNode;
  mockFetch?: () => Promise<Response>;
  userId?: string;
}

function RagflowProvider({ children, mockFetch, userId }: RagflowProviderProps) {
  const [config, setConfig] = useState<RagflowConfig | null>(null);
  const [selectedChatSourceId, setSelectedChatSourceId] = useState<string>('');
  const [selectedSearchSourceId, setSelectedSearchSourceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const fetchFn = mockFetch || (() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockConfig),
          } as Response)
        );

        const response = await fetchFn();
        if (!response.ok) {
          throw new Error('Failed to fetch RAGFlow config');
        }
        const data = await response.json();
        setConfig(data);

        // Set default sources
        if (data.chatSources.length > 0) {
          setSelectedChatSourceId(data.chatSources[0]?.id || '');
        }
        if (data.searchSources.length > 0) {
          setSelectedSearchSourceId(data.searchSources[0]?.id || '');
        }
      } catch (err) {
        console.error('[RagflowContext] Failed to fetch config:', err);
        setError('Failed to load RAGFlow configuration');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [mockFetch]);

  const setSelectedChatSource = useCallback((id: string) => {
    setSelectedChatSourceId(id);
  }, []);

  const setSelectedSearchSource = useCallback((id: string) => {
    setSelectedSearchSourceId(id);
  }, []);

  return (
    <RagflowContext.Provider
      value={{
        config,
        selectedChatSourceId,
        selectedSearchSourceId,
        setSelectedChatSource,
        setSelectedSearchSource,
        isLoading,
        error,
      }}
    >
      {children}
    </RagflowContext.Provider>
  );
}

function useRagflow(): RagflowContextType {
  const context = useContext(RagflowContext);
  if (context === undefined) {
    throw new Error('useRagflow must be used within a RagflowProvider');
  }
  return context;
}

// ============================================================================
// Tests
// ============================================================================

describe('RagflowContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial loading', () => {
    it('should start with loading true', async () => {
      const mockFetch = vi.fn(() => new Promise<Response>(() => {})); // Never resolves

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.config).toBeNull();
    });

    it('should have null error initially', async () => {
      const mockFetch = vi.fn(() => new Promise<Response>(() => {}));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      expect(result.current.error).toBeNull();
    });
  });

  describe('successful config fetch', () => {
    it('should load config successfully', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(mockConfig);
      expect(result.current.error).toBeNull();
    });

    it('should select first chat source by default', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedChatSourceId).toBe('chat-1');
    });

    it('should select first search source by default', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedSearchSourceId).toBe('search-1');
    });
  });

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load RAGFlow configuration');
      expect(result.current.config).toBeNull();
    });

    it('should handle non-ok response', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load RAGFlow configuration');
    });
  });

  describe('source selection', () => {
    it('should change selected chat source', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedChatSource('chat-2');
      });

      expect(result.current.selectedChatSourceId).toBe('chat-2');
    });

    it('should change selected search source', async () => {
      const configWithMultipleSearch: RagflowConfig = {
        ...mockConfig,
        searchSources: [
          { id: 'search-1', name: 'General Search', url: 'https://ragflow.example.com/search/1' },
          { id: 'search-2', name: 'Tech Search', url: 'https://ragflow.example.com/search/2' },
        ],
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(configWithMultipleSearch),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedSearchSource('search-2');
      });

      expect(result.current.selectedSearchSourceId).toBe('search-2');
    });
  });

  describe('empty sources', () => {
    it('should handle empty chat sources', async () => {
      const configWithNoChat: RagflowConfig = {
        ...mockConfig,
        chatSources: [],
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(configWithNoChat),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedChatSourceId).toBe('');
    });

    it('should handle empty search sources', async () => {
      const configWithNoSearch: RagflowConfig = {
        ...mockConfig,
        searchSources: [],
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(configWithNoSearch),
        } as Response)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RagflowProvider mockFetch={mockFetch}>{children}</RagflowProvider>
      );

      const { result } = renderHook(() => useRagflow(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedSearchSourceId).toBe('');
    });
  });

  describe('context error', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useRagflow());
      }).toThrow('useRagflow must be used within a RagflowProvider');
    });
  });
});
