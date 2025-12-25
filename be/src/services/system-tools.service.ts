
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

    // Resolve config file and load tools into memory
    async initialize(): Promise<void> {
        this.configPath = await this.resolveConfigPath();
        await this.loadConfig();
    }

    // Pick config path from env > docker mount > repo config
    private async resolveConfigPath(): Promise<string> {
        const envPath = config.systemToolsConfigPath;
        if (envPath) {
            try {
                await fs.access(envPath, constants.F_OK);
                return envPath;
            } catch { }
        }

        const dockerPath = '/app/config/system-tools.config.json';
        try {
            await fs.access(dockerPath, constants.F_OK);
            return dockerPath;
        } catch { }

        const fallbackPath = path.join(__dirname, '../config/system-tools.config.json');
        return fallbackPath;
    }

    // Read and parse system-tools config JSON
    private async loadConfig(): Promise<void> {
        try {
            try {
                await fs.access(this.configPath, constants.F_OK);
            } catch {
                log.warn('System tools config file not found', { path: this.configPath });
                this.tools = [];
                return;
            }

            const configData = await fs.readFile(this.configPath, 'utf-8');
            const config: SystemToolsConfig = JSON.parse(configData);

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

    // Alias for controller or internal use
    getTools(): SystemTool[] {
        return this.getEnabledTools();
    }

    // Return enabled tools ordered for UI consumption
    getEnabledTools(): SystemTool[] {
        return this.tools
            .filter(tool => tool.enabled)
            .sort((a, b) => a.order - b.order);
    }

    // Return all tools regardless of enabled flag
    getAllTools(): SystemTool[] {
        return [...this.tools].sort((a, b) => a.order - b.order);
    }

    // Reload configuration from disk
    async reload(): Promise<void> {
        log.debug('Reloading system tools configuration');
        await this.loadConfig();
    }

    // Placeholder executor for system tools
    async runTool(id: string, params: any): Promise<any> {
        const tool = this.tools.find(t => t.id === id);
        if (!tool) throw new Error('Tool not found');
        return { message: `Tool ${tool.name} executed`, params };
    }

    // Aggregate service health (DB, Redis, MinIO, Langfuse) plus host metrics
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

        const { minioService } = await import('@/services/minio.service.js');
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
