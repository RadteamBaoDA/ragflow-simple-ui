/**
 * @fileoverview Vite environment type declarations.
 * 
 * Extends Vite's default type definitions with custom environment
 * variables and global constants used in this application.
 * 
 * @module vite-env
 */

/// <reference types="vite/client" />

/**
 * Extended Vite environment variables.
 * Access these via import.meta.env.VARIABLE_NAME
 */
interface ImportMetaEnv {
  /** Backend API base URL (e.g., http://localhost:3001) */
  readonly VITE_API_BASE_URL: string;
  /** RAGFlow chat iframe path */
  readonly VITE_RAGFLOW_CHAT_PATH: string;
  /** RAGFlow search iframe path */
  readonly VITE_RAGFLOW_SEARCH_PATH: string;
  /** Development mode flag (set by Vite) */
  readonly DEV: boolean;
  /** Production mode flag (set by Vite) */
  readonly PROD: boolean;
  /** Current mode: 'development' | 'production' | 'test' */
  readonly MODE: string;
}

/**
 * Extended ImportMeta interface for Vite.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ============================================================================
// Global Constants (Injected by Vite)
// ============================================================================

/**
 * Shared storage domain for cross-subdomain cookie/localStorage.
 * Injected at build time via vite.config.ts define option.
 * Used for sharing user session across subdomains (e.g., *.example.com)
 */
declare const __SHARED_STORAGE_DOMAIN__: string;
