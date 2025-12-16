/**
 * @fileoverview System tools service for fetching monitoring tool configuration.
 * 
 * Provides API functions for system monitoring tools:
 * - Fetch enabled tools from backend
 * - Reload configuration (admin only)
 * 
 * @module services/systemToolsService
 */

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

/**
 * System monitoring tool configuration.
 */
export interface SystemTool {
    /** Unique tool identifier */
    id: string;
    /** Display name */
    name: string;
    /** Tool description */
    description: string;
    /** Icon path (relative to /static/icons/) */
    icon: string;
    /** External URL to open */
    url: string;
    /** Display order (lower = first) */
    order: number;
    /** Whether tool is enabled */
    enabled: boolean;
}

/**
 * Response from system tools API.
 */
export interface SystemToolsResponse {
    /** Array of tool configurations */
    tools: SystemTool[];
    /** Total count of tools */
    count: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all enabled system monitoring tools.
 * @returns Array of enabled system tools
 * @throws Error if fetch fails
 */
export const getSystemTools = async (): Promise<SystemTool[]> => {
    const response = await fetch(`${API_BASE_URL}/api/system-tools`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch system tools: ${response.statusText}`);
    }

    const data: SystemToolsResponse = await response.json();
    return data.tools;
};

/**
 * Reload system tools configuration from disk.
 * Requires admin role.
 * @throws Error if reload fails
 */
export const reloadSystemTools = async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/system-tools/reload`, {
        method: 'POST',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to reload system tools: ${response.statusText}`);
    }
};
