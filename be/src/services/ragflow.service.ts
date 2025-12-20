/**
 * @fileoverview RAGFlow configuration service.
 * 
 * This module manages the configuration for RAGFlow AI Chat and Search
 * iframe URLs. Configuration is stored in the database.
 * 
 * @module services/ragflow
 */

import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.service.js';
import { db } from '../db/index.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a RAGFlow source configuration.
 */
export interface RagflowSource {
    /** Unique source identifier */
    id: string;
    /** 'chat' or 'search' */
    type: string;
    /** Display name in UI */
    name: string;
    /** RAGFlow iframe URL */
    url: string;
}

/**
 * RAGFlow configuration structure.
 */
export interface RagflowConfig {
    defaultChatSourceId: string;
    defaultSearchSourceId: string;
    chatSources: RagflowSource[];
    searchSources: RagflowSource[];
}

/**
 * Paginated response for sources
 */
export interface PaginatedSources {
    data: RagflowSource[];
    total: number;
    page: number;
    limit: number;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing RAGFlow configuration.
 * Interact with `system_configs` and `ragflow_sources` tables.
 */
class RagflowService {

    constructor() { }

    /**
     * Initialize the service.
     */
    async initialize(): Promise<void> {
        // Potential future use: Check if DB is empty and seed from file
    }

    /**
     * Get the global RAGFlow configuration (lists of sources and default IDs).
     */
    async getConfig(): Promise<RagflowConfig> {
        // Fetch default source IDs
        const defaultChatId = await db.queryOne<{ value: string }>('SELECT value FROM system_configs WHERE key = $1', ['default_chat_source_id']);
        const defaultSearchId = await db.queryOne<{ value: string }>('SELECT value FROM system_configs WHERE key = $1', ['default_search_source_id']);

        // Fetch all sources
        // Note: For a very large number of sources, we might want to optimize this,
        // but for configuration binding on the frontend, we typically need the lists.
        // If lists become huge, the frontend should use the paginated endpoint instead.
        const sources = await db.query<RagflowSource>('SELECT * FROM ragflow_sources ORDER BY name ASC');
        const chatSources = sources.filter(s => s.type === 'chat');
        const searchSources = sources.filter(s => s.type === 'search');

        return {
            defaultChatSourceId: defaultChatId?.value || '',
            defaultSearchSourceId: defaultSearchId?.value || '',
            chatSources,
            searchSources,
        };
    }

    /**
     * Get all sources (chat and search) - primarily for Dropdown or internal use.
     * Warning: This returns all sources. For management UI, use getSourcesPaginated.
     */
    async getAllSources(): Promise<{ chatSources: RagflowSource[], searchSources: RagflowSource[] }> {
        const sources = await db.query<RagflowSource>('SELECT * FROM ragflow_sources ORDER BY name ASC');
        return {
            chatSources: sources.filter(s => s.type === 'chat'),
            searchSources: sources.filter(s => s.type === 'search'),
        };
    }

    /**
     * Get sources with pagination.
     */
    async getSourcesPaginated(type: 'chat' | 'search', page: number = 1, limit: number = 10): Promise<PaginatedSources> {
        const offset = (page - 1) * limit;

        const countResult = await db.queryOne<{ count: string }>(
            'SELECT COUNT(*) as count FROM ragflow_sources WHERE type = $1',
            [type]
        );
        const total = parseInt(countResult?.count || '0', 10);

        const data = await db.query<RagflowSource>(
            'SELECT * FROM ragflow_sources WHERE type = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [type, limit, offset]
        );

        return { data, total, page, limit };
    }

    /**
     * Update a system configuration (default source IDs).
     */
    async saveSystemConfig(key: 'default_chat_source_id' | 'default_search_source_id', value: string): Promise<void> {
        await db.query(
            `INSERT INTO system_configs (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
        );
        log.info(`Updated system config: ${key}`);
    }

    /**
     * Add a new source.
     */
    async addSource(type: 'chat' | 'search', name: string, url: string): Promise<RagflowSource> {
        const id = uuidv4();
        await db.query(
            'INSERT INTO ragflow_sources (id, type, name, url) VALUES ($1, $2, $3, $4)',
            [id, type, name, url]
        );
        log.info(`Added new ${type} source`, { id, name });
        return { id, type, name, url };
    }

    /**
     * Update an existing source.
     */
    async updateSource(id: string, name: string, url: string): Promise<void> {
        await db.query(
            'UPDATE ragflow_sources SET name = $1, url = $2, updated_at = NOW() WHERE id = $3',
            [name, url, id]
        );
        log.info('Updated source', { id });
    }

    /**
     * Delete a source.
     */
    async deleteSource(id: string): Promise<void> {
        await db.query('DELETE FROM ragflow_sources WHERE id = $1', [id]);
        log.info('Deleted source', { id });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton service instance */
export const ragflowService = new RagflowService();

