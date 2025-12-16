/**
 * @fileoverview RAGFlow configuration service.
 * 
 * This module manages the configuration for RAGFlow AI Chat and Search
 * iframe URLs. Configuration is loaded from a JSON file that can be
 * customized via Docker volume mount.
 * 
 * Configuration file location (in order of priority):
 * 1. RAGFLOW_CONFIG_PATH environment variable
 * 2. /app/config/ragflow.config.json (Docker volume mount)
 * 3. be/src/config/ragflow.config.json (default/fallback)
 * 
 * @module services/ragflow
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
 * Represents a RAGFlow source configuration.
 */
export interface RagflowSource {
    /** Unique source identifier */
    id: string;
    /** Display name in UI */
    name: string;
    /** RAGFlow iframe URL */
    url: string;
}

/**
 * RAGFlow configuration file structure.
 */
export interface RagflowConfig {
    /** Primary AI Chat iframe URL */
    aiChatUrl: string;
    /** Primary AI Search iframe URL */
    aiSearchUrl: string;
    /** Available chat sources */
    chatSources: RagflowSource[];
    /** Available search sources */
    searchSources: RagflowSource[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing RAGFlow configuration.
 * Loads configuration from a JSON file and provides
 * methods to query chat/search URLs and sources.
 */
class RagflowService {
    /** Loaded configuration */
    private ragflowConfig: RagflowConfig = {
        aiChatUrl: '',
        aiSearchUrl: '',
        chatSources: [],
        searchSources: [],
    };
    /** Path to the configuration file */
    private configPath: string = '';

    /**
     * Creates a new RagflowService.
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
        const envPath = config.ragflowConfigPath;
        if (envPath) {
            try {
                await fs.access(envPath, constants.F_OK);
                log.debug('Using RAGFlow config from environment variable', { path: envPath });
                return envPath;
            } catch {
                // Ignore
            }
        }

        // 2. Check Docker volume mount location
        const dockerPath = '/app/config/ragflow.config.json';
        try {
            await fs.access(dockerPath, constants.F_OK);
            log.debug('Using RAGFlow config from Docker volume', { path: dockerPath });
            return dockerPath;
        } catch {
            // Ignore
        }

        // 3. Fallback to bundled config (relative to compiled code)
        const fallbackPath = path.join(__dirname, '../config/ragflow.config.json');
        log.debug('Using bundled RAGFlow config', { path: fallbackPath });
        return fallbackPath;
    }

    /**
     * Load RAGFlow configuration from JSON file.
     * Called on startup and when reload() is invoked.
     */
    private async loadConfig(): Promise<void> {
        try {
            // Check if config file exists
            try {
                await fs.access(this.configPath, constants.F_OK);
            } catch {
                log.warn('RAGFlow config file not found', { path: this.configPath });
                return;
            }

            // Read and parse JSON configuration
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const loadedConfig: RagflowConfig = JSON.parse(configData);

            // Validate config structure
            if (!loadedConfig.chatSources || !Array.isArray(loadedConfig.chatSources)) {
                loadedConfig.chatSources = [];
            }
            if (!loadedConfig.searchSources || !Array.isArray(loadedConfig.searchSources)) {
                loadedConfig.searchSources = [];
            }

            this.ragflowConfig = loadedConfig;
            log.debug('RAGFlow configuration loaded', {
                chatSources: this.ragflowConfig.chatSources.length,
                searchSources: this.ragflowConfig.searchSources.length,
            });
        } catch (error) {
            log.error('Failed to load RAGFlow config', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Get the full RAGFlow configuration.
     * Used by the API to return config to frontend.
     */
    getConfig(): RagflowConfig {
        return this.ragflowConfig;
    }

    /**
     * Get primary AI Chat URL.
     */
    getAiChatUrl(): string {
        return this.ragflowConfig.aiChatUrl;
    }

    /**
     * Get primary AI Search URL.
     */
    getAiSearchUrl(): string {
        return this.ragflowConfig.aiSearchUrl;
    }

    /**
     * Get all chat sources.
     */
    getChatSources(): RagflowSource[] {
        return this.ragflowConfig.chatSources;
    }

    /**
     * Get all search sources.
     */
    getSearchSources(): RagflowSource[] {
        return this.ragflowConfig.searchSources;
    }

    /**
     * Reload configuration from file.
     * Call this after modifying the config file to apply changes
     * without restarting the server.
     */
    async reload(): Promise<void> {
        log.debug('Reloading RAGFlow configuration');
        await this.loadConfig();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton service instance */
export const ragflowService = new RagflowService();
