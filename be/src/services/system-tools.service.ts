
// Loads system tool metadata from JSON and exposes health checks.
import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '@/services/logger.service.js';
import { config } from '@/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    url: string;
    order: number;
    enabled: boolean;
}

interface SystemToolsConfig {
    tools: SystemTool[];
}

class SystemToolsService {
    private tools: SystemTool[] = [];
    private configPath: string = '';

    constructor() {
    }

    /**
     * Resolve config file and load tools into memory.
     * @returns Promise<void>
     * @description Initializes the service by loading configuration.
     */
    async initialize(): Promise<void> {
        this.configPath = await this.resolveConfigPath();
        await this.loadConfig();
    }

    /**
     * Pick config path from env > docker mount > repo config.
     * @returns Promise<string> - The resolved config file path.
     * @description Checks multiple locations for the system tools config file.
     */
    private async resolveConfigPath(): Promise<string> {
        // 1. Check environment variable
        const envPath = config.systemToolsConfigPath;
        if (envPath) {
            try {
                await fs.access(envPath, constants.F_OK);
                return envPath;
            } catch { }
        }

        // 2. Check docker volume mount
        const dockerPath = '/app/config/system-tools.config.json';
        try {
            await fs.access(dockerPath, constants.F_OK);
            return dockerPath;
        } catch { }

        // 3. Fallback to local source file
        const fallbackPath = path.join(__dirname, '../config/system-tools.config.json');
        return fallbackPath;
    }

    /**
     * Read and parse system-tools config JSON.
     * @returns Promise<void>
     * @description Loads tool definitions from the filtered config file.
     */
    private async loadConfig(): Promise<void> {
        try {
            try {
                // Verify file exists
                await fs.access(this.configPath, constants.F_OK);
            } catch {
                log.warn('System tools config file not found', { path: this.configPath });
                this.tools = [];
                return;
            }

            // Read file content
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const config: SystemToolsConfig = JSON.parse(configData);

            // Validate structure
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
     * Alias for getEnabledTools().
     * @returns SystemTool[] - List of enabled tools.
     * @description Public method to retrieve available tools.
     */
    getTools(): SystemTool[] {
        return this.getEnabledTools();
    }

    /**
     * Return enabled tools ordered for UI consumption.
     * @returns SystemTool[] - Sorted and filtered tools.
     * @description Filters by enabled flag and sorts by order prop.
     */
    getEnabledTools(): SystemTool[] {
        return this.tools
            .filter(tool => tool.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Return all tools regardless of enabled flag.
     * @returns SystemTool[] - All configured tools.
     */
    getAllTools(): SystemTool[] {
        return [...this.tools].sort((a, b) => a.order - b.order);
    }

    /**
     * Reload configuration from disk.
     * @returns Promise<void>
     * @description Forces a reload of the config file.
     */
    async reload(): Promise<void> {
        log.debug('Reloading system tools configuration');
        await this.loadConfig();
    }

    /**
     * Placeholder executor for system tools.
     * @param id - Tool ID.
     * @param params - Execution parameters.
     * @returns Promise<any> - Execution result.
     * @throws Error if tool not found.
     * @description Reserved for future tool execution logic.
     */
    async runTool(id: string, params: any): Promise<any> {
        const tool = this.tools.find(t => t.id === id);
        if (!tool) throw new Error('Tool not found');
        return { message: `Tool ${tool.name} executed`, params };
    }

    /**
     * Aggregate service health (DB, Redis, MinIO, Langfuse) plus host metrics.
     * @returns Promise<any> - Health status object.
     * @description Checks connections to dependencies and gathers system stats.
     */
    async getSystemHealth(): Promise<any> {
        const os = await import('os');

        // Check Database - Knex
        const { db } = await import('@/db/knex.js');
        let dbStatus = false;
        try {
            await db.raw('SELECT 1');
            dbStatus = true;
        } catch (e) {
            dbStatus = false;
        }



        // Check Langfuse
        const langfuseEnabled = !!(config.langfuse.publicKey && config.langfuse.secretKey && config.langfuse.baseUrl);
        const langfuseStatus = langfuseEnabled ? 'enabled' : 'disabled';

        // Check Redis for session
        let redisStatus = 'disconnected';
        try {
            const { createClient } = await import('redis');
            const client = createClient({
                url: config.redis.url,
                socket: {
                    connectTimeout: 2000
                }
            });
            client.on('error', () => { }); // Prevent crash on error
            await client.connect();
            await client.ping();
            redisStatus = 'connected';
            await client.disconnect();
        } catch (e) {
            redisStatus = 'disconnected';
        }

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

export const systemToolsService = new SystemToolsService();
