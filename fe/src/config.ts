/**
 * @fileoverview Application configuration module.
 * 
 * Centralizes access to environment variables and feature flags.
 * All feature toggles are controlled via VITE_* environment variables.
 * 
 * Environment Variables:
 * - VITE_ENABLE_AI_CHAT: Enable AI Chat feature (default: true)
 * - VITE_ENABLE_AI_SEARCH: Enable AI Search feature (default: true)
 * - VITE_ENABLE_HISTORY: Enable chat history feature (default: true)
 * 
 * @module config
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses a boolean environment variable.
 * 
 * @param key - Environment variable key (VITE_* prefix)
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed boolean value
 */
const getBoolEnv = (key: string, defaultValue: boolean): boolean => {
    const value = import.meta.env[key];
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
};

// ============================================================================
// Configuration Export
// ============================================================================

/**
 * Application configuration object.
 * Contains all feature flags and settings.
 */
export const config = {
    /** Feature toggles for conditional rendering */
    features: {
        /** Enable AI Chat page with RAGFlow chat iframe */
        enableAiChat: getBoolEnv('VITE_ENABLE_AI_CHAT', true),
        /** Enable AI Search page with RAGFlow search iframe */
        enableAiSearch: getBoolEnv('VITE_ENABLE_AI_SEARCH', true),
        /** Enable chat history page */
        enableHistory: getBoolEnv('VITE_ENABLE_HISTORY', true),
    },
};
