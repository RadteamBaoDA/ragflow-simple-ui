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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// ============================================================================
// React Query Configuration
// ============================================================================

/**
 * React Query client with default options.
 * 
 * Configuration:
 * - staleTime: 5 minutes - data remains fresh for 5 minutes
 * - retry: 1 - retry failed requests once before throwing
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
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
