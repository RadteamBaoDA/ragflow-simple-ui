/**
 * @fileoverview Application entry point.
 * 
 * Bootstraps the React application with required providers:
 * - React Query for data fetching and caching
 * - React Router for client-side navigation
 * - Strict Mode for development checks
 * 
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { message } from 'antd';
import App from '@/app/App';
import './index.css';

// ============================================================================
// React Query Configuration
// ============================================================================

/**
 * React Query client with default options and global notification handlers.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      // Check if the mutation meta has a custom success message
      // Or use a default one for POST/PUT/DELETE
      const isCrud = mutation.options.mutationKey?.some(key =>
        ['create', 'update', 'delete', 'save', 'remove'].includes(String(key).toLowerCase())
      );

      // If meta provides a success message, show it
      if (mutation.options.meta?.successMessage) {
        message.success(mutation.options.meta.successMessage as string);
      } else if (isCrud) {
        message.success('Action completed successfully');
      }
    },
    onError: (error: any) => {
      // Show error notification globally
      const errorMessage = error.message || 'An unexpected error occurred';
      message.error(errorMessage);
    },
  }),
});

// ============================================================================
// Application Mount
// ============================================================================

/**
 * Mount the React application to the DOM.
 * Uses createRoot for React 18 concurrent features.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
