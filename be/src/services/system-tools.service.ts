/**
 * @fileoverview System monitoring tools service.
 * 
 * This module manages the configuration for system monitoring tools
 * that are displayed to administrators. Tools are configured via a
 * JSON file and can be enabled/disabled without code changes.
 * 
 * Configuration file location (in order of priority):
 * 1. SYSTEM_TOOLS_CONFIG_PATH environment variable
 * 2. /app/config/system-tools.config.json (Docker volume mount)
 * 3. be/src/config/system-tools.config.json (default/fallback)
 * 
 * Each tool has:
 * - Unique ID for referencing
 * - Display name and description
 * - Icon for UI display
 * - External URL to open when clicked
 * - Order for sorting in UI
 * - Enabled flag for show/hide control
 * 
 * @module services/system-tools
 */

import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.service.js';
import { config } from '../config/index.js';

/** ESM-compatible __dirname resolution */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a system monitoring tool configuration.
 */
export interface SystemTool {
    /** Unique tool identifier */
    id: string;
    /** Display name in UI */
    name: string;
    /** Tool description/purpose */
    description: string;
    /** Icon name or path for UI display */
    icon: string;
    /** External URL to the tool */
    url: string;
    /** Sort order (lower = first) */
    order: number;
    /** Whether tool is shown in UI */
    enabled: boolean;
}

/**
 * Configuration file structure.
 */
interface SystemToolsConfig {
    /** Array of tool configurations */
    tools: SystemTool[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing system monitoring tools.
 * Loads tool configurations from a JSON file and provides
 * methods to query enabled tools.
 */
class SystemToolsService {
    /** Loaded tool configurations */
    private tools: SystemTool[] = [];
    /** Path to the configuration file */
    private configPath: string = '';

    /**
     * Creates a new SystemToolsService.
     * Configuration is loaded asynchronously via initialize().
     */
    constructor() {
    }

    /**
     * Initialize the service.
     * Must be called before use.
     */
    async initialize(): Promise<void> {
        this.configPath = await this.resolveConfigPath();
        await this.loadConfig();
    }

    /**
     * Resolve the configuration file path.
     * Checks multiple locations in order of priority.
     */
    private async resolveConfigPath(): Promise<string> {
        // 1. Check environment variable
        const envPath = config.systemToolsConfigPath;
        if (envPath) {
            try {
                await fs.access(envPath, constants.F_OK);
                log.debug('Using system tools config from environment variable', { path: envPath });
                return envPath;
            } catch {
                // Ignore and continue
            }
        }

        // 2. Check Docker volume mount location
        const dockerPath = '/app/config/system-tools.config.json';
        try {
            await fs.access(dockerPath, constants.F_OK);
            log.debug('Using system tools config from Docker volume', { path: dockerPath });
            return dockerPath;
        } catch {
            // Ignore and continue
        }

        // 3. Fallback to bundled config (relative to compiled code)
        const fallbackPath = path.join(__dirname, '../config/system-tools.config.json');
        log.debug('Using bundled system tools config', { path: fallbackPath });
        return fallbackPath; // We assume this exists or loadConfig will fail gracefully
    }

    /**
     * Load system tools configuration from JSON file.
     * Called on startup and when reload() is invoked.
     */
    private async loadConfig(): Promise<void> {
        try {
            // Check if config file exists
            try {
                await fs.access(this.configPath, constants.F_OK);
            } catch {
                log.warn('System tools config file not found', { path: this.configPath });
                this.tools = [];
                return;
            }

            // Read and parse JSON configuration
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const config: SystemToolsConfig = JSON.parse(configData);

            // Validate config structure
            if (!config.tools || !Array.isArray(config.tools)) {
                log.error('Invalid system tools config format');
                this.tools = [];
                return;
            }

            this.tools = config.tools;
            log.debug('System tools configuration loaded', { count: this.tools.length });
        } catch (error) {
            log.error('Failed to load system tools config', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.tools = [];
        }
    }

    /**
     * Get all enabled system tools, sorted by order.
     * Used by the frontend to display available tools.
     * 
     * @returns Array of enabled tools sorted by order property
     */
    getEnabledTools(): SystemTool[] {
        return this.tools
            .filter(tool => tool.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get all system tools including disabled ones.
     * Useful for admin configuration interfaces.
     * 
     * @returns Array of all tools sorted by order
     */
    getAllTools(): SystemTool[] {
        return [...this.tools].sort((a, b) => a.order - b.order);
    }

    /**
     * Reload configuration from file.
     * Call this after modifying the config file to apply changes
     * without restarting the server.
     */
    async reload(): Promise<void> {
        log.debug('Reloading system tools configuration');
        await this.loadConfig();
    }

    /**
     * Get system health and metrics.
     * Aggregates status from Database, Redis, MinIO, Langfuse, and System resources.
     * 
     * @returns System health object
     */
    async getSystemHealth(): Promise<any> {
        const os = await import('os');
        const { checkConnection } = await import('../db/index.js');
        const { getRedisStatus } = await import('./redis.service.js');
        const { minioService } = await import('./minio.service.js');
        const { getLangfuseClient, checkHealth: checkLangfuseHealth } = await import('./langfuse.service.js');

        // Check Database
        const dbStatus = await checkConnection();

        // Check Redis
        const redisStatus = getRedisStatus();

        // Check MinIO
        // MinIO is enabled if credentials are provided in env
        const minioEnabled = !!(process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY);
        let minioStatus = 'disconnected';
        if (minioEnabled) {
            try {
                await minioService.listBuckets();
                minioStatus = 'connected';
            } catch (e) {
                minioStatus = 'disconnected';
            }
        }

        // Check Langfuse
        const langfuseEnabled = !!(config.langfuse.publicKey && config.langfuse.secretKey && config.langfuse.baseUrl);
        const langfuseHealthy = await checkLangfuseHealth();
        const langfuseStatus = langfuseHealthy ? 'connected' : 'disconnected';

        return {
            timestamp: new Date().toISOString(),
            services: {
                database: {
                    status: dbStatus ? 'connected' : 'disconnected',
                    enabled: true,
                    host: config.database.host,
                },
                redis: {
                    status: redisStatus,
                    enabled: true,
                    host: config.redis.host,
                },
                minio: {
                    status: minioStatus,
                    enabled: minioEnabled,
                    host: process.env.MINIO_ENDPOINT || 'localhost',
                },
                langfuse: {
                    status: langfuseStatus,
                    enabled: langfuseEnabled,
                    host: config.langfuse.baseUrl ? new URL(config.langfuse.baseUrl).hostname : 'unknown',
                },
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                loadAvg: os.loadavg(),
                cpus: os.cpus().length,
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                nodeVersion: process.version,
                cpuModel: os.cpus()[0]?.model || 'Unknown',
                totalMemory: os.totalmem(),
                osRelease: os.release(),
                osType: os.type(),
                disk: await (async () => {
                    try {
                        // Check disk space of the drive where the app is running
                        const stats = await fs.statfs(process.cwd());
                        return {
                            total: stats.bsize * stats.blocks,
                            free: stats.bsize * stats.bfree,
                            available: stats.bsize * stats.bavail
                        };
                    } catch (e) {
                        return undefined;
                    }
                })()
            }
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton service instance */
export const systemToolsService = new SystemToolsService();

