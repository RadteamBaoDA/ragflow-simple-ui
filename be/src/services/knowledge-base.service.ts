/**
 * @fileoverview Knowledge Base configuration service.
 * 
 * This module manages the configuration for Knowledge Base AI Chat and Search
 * iframe URLs. Configuration is stored in the database.
 * 
 * @module services/knowledge-base
 */

import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.service.js';
import { db } from '../db/index.js';
import { auditService, AuditAction, AuditResourceType } from './audit.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a Knowledge Base source configuration.
 */
export interface KnowledgeBaseSource {
    /** Unique source identifier */
    id: string;
    /** 'chat' or 'search' */
    type: string;
    /** Display name in UI */
    name: string;
    /** Iframe URL */
    url: string;
    /** Access control settings */
    access_control?: AccessControl;
}

export interface AccessControl {
    public: boolean;
    team_ids: string[];
    user_ids: string[];
}

/**
 * Knowledge Base configuration structure.
 */
export interface KnowledgeBaseConfig {
    defaultChatSourceId: string;
    defaultSearchSourceId: string;
    chatSources: KnowledgeBaseSource[];
    searchSources: KnowledgeBaseSource[];
}

/**
 * Paginated response for sources
 */
export interface PaginatedSources {
    data: KnowledgeBaseSource[];
    total: number;
    page: number;
    limit: number;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing Knowledge Base configuration.
 * Interact with `system_configs` and `knowledge_base_sources` tables.
 */
class KnowledgeBaseService {

    constructor() { }

    /**
     * Initialize the service.
     */
    async initialize(): Promise<void> {
    }

    /**
     * Get the global Knowledge Base configuration (lists of sources and default IDs).
     */
    async getConfig(user?: { id: string, role: string, permissions?: string[] }, userTeamIds: string[] = []): Promise<KnowledgeBaseConfig> {
        // Fetch default source IDs
        const defaultChatId = await db.queryOne<{ value: string }>('SELECT value FROM system_configs WHERE key = $1', ['default_chat_source_id']);
        const defaultSearchId = await db.queryOne<{ value: string }>('SELECT value FROM system_configs WHERE key = $1', ['default_search_source_id']);

        // Fetch all sources
        const sources = await db.query<KnowledgeBaseSource>('SELECT * FROM knowledge_base_sources ORDER BY name ASC');

        // Filter sources based on permissions
        const allowedSources = sources.filter(source => {
            // Admin sees all
            if (user?.role === 'admin') return true;

            // Default fallback if no access_control is set (migration handling)
            const acl = source.access_control || { public: true, team_ids: [], user_ids: [] };

            // Public access
            if (acl.public) return true;

            // Check specific user access
            if (user && acl.user_ids?.includes(user.id)) return true;

            // Check team access
            if (userTeamIds.length > 0 && acl.team_ids?.some(tid => userTeamIds.includes(tid))) return true;

            return false;
        });

        const chatSources = allowedSources.filter(s => s.type === 'chat');
        const searchSources = allowedSources.filter(s => s.type === 'search');

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
    async getAllSources(): Promise<{ chatSources: KnowledgeBaseSource[], searchSources: KnowledgeBaseSource[] }> {
        const sources = await db.query<KnowledgeBaseSource>('SELECT * FROM knowledge_base_sources ORDER BY name ASC');
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
            'SELECT COUNT(*) as count FROM knowledge_base_sources WHERE type = $1',
            [type]
        );
        const total = parseInt(countResult?.count || '0', 10);

        const data = await db.query<KnowledgeBaseSource>(
            'SELECT * FROM knowledge_base_sources WHERE type = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [type, limit, offset]
        );

        return { data, total, page, limit };
    }

    /**
     * Update a system configuration (default source IDs).
     */
    async saveSystemConfig(key: 'default_chat_source_id' | 'default_search_source_id', value: string, user?: { id: string, email: string }): Promise<void> {
        await db.query(
            `INSERT INTO system_configs (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
        );

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.UPDATE_CONFIG,
                resourceType: AuditResourceType.CONFIG,
                resourceId: key,
                details: { value },
            });
        }

        log.info(`Updated system config: ${key}`);
    }

    /**
     * Add a new source.
     */
    async addSource(
        type: 'chat' | 'search',
        name: string,
        url: string,
        access_control: AccessControl = { public: false, team_ids: [], user_ids: [] },
        user?: { id: string, email: string }
    ): Promise<KnowledgeBaseSource> {
        const id = uuidv4();
        await db.query(
            'INSERT INTO knowledge_base_sources (id, type, name, url, access_control) VALUES ($1, $2, $3, $4, $5)',
            [id, type, name, url, JSON.stringify(access_control)]
        );

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.CREATE_SOURCE,
                resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                resourceId: id,
                details: { type, name, url, access_control },
            });
        }

        log.info(`Added new ${type} source`, { id, name });
        return { id, type, name, url, access_control };
    }

    /**
     * Update an existing source.
     */
    async updateSource(
        id: string,
        name: string,
        url: string,
        access_control?: AccessControl,
        user?: { id: string, email: string }
    ): Promise<void> {
        if (access_control) {
            await db.query(
                'UPDATE knowledge_base_sources SET name = $1, url = $2, access_control = $3, updated_at = NOW() WHERE id = $4',
                [name, url, JSON.stringify(access_control), id]
            );
        } else {
            await db.query(
                'UPDATE knowledge_base_sources SET name = $1, url = $2, updated_at = NOW() WHERE id = $3',
                [name, url, id]
            );
        }

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.UPDATE_SOURCE,
                resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                resourceId: id,
                details: { name, url, access_control },
            });
        }

        log.info('Updated source', { id });
    }

    /**
     * Delete a source.
     */
    async deleteSource(id: string, user?: { id: string, email: string }): Promise<void> {
        const source = await db.queryOne<{ name: string }>('SELECT name FROM knowledge_base_sources WHERE id = $1', [id]);

        await db.query('DELETE FROM knowledge_base_sources WHERE id = $1', [id]);

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.DELETE_SOURCE,
                resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                resourceId: id,
                details: { name: source?.name },
            });
        }

        log.info('Deleted source', { id });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton service instance */
export const knowledgeBaseService = new KnowledgeBaseService();
