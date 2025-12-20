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

/**
 * System health response.
 */
export interface SystemHealth {
    timestamp: string;
    services: {
        database: { status: 'connected' | 'disconnected', enabled: boolean, host: string };
        redis: { status: 'connected' | 'connecting' | 'disconnected' | 'not_initialized' | 'not_configured', enabled: boolean, host: string };
        minio: { status: 'connected' | 'disconnected', enabled: boolean, host: string };
        langfuse: { status: 'connected' | 'disconnected', enabled: boolean, host: string };
    };
    system: {
        uptime: number;
        memory: {
            rss: number;
            heapTotal: number;
            heapUsed: number;
            external: number;
        };
        loadAvg: number[];
        cpus: number;
        platform: string;
        arch: string;
        hostname: string;
        nodeVersion?: string;
        cpuModel?: string;
        totalMemory?: number;
        osRelease?: string;
        osType?: string;
        disk?: {
            total: number;
            free: number;
            available: number;
        };
    };
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

/**
 * Get system health metrics.
 * @returns System health data
 */
export const getSystemHealth = async (): Promise<SystemHealth> => {
    const response = await fetch(`${API_BASE_URL}/api/system-tools/health`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch system health: ${response.statusText}`);
    }

    return await response.json();
};
