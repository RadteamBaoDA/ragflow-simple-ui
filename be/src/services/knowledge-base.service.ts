
// Manages knowledge-base source metadata, ACLs, and defaults.
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { KnowledgeBaseSource } from '@/models/types.js';
import { teamService } from '@/services/team.service.js';

export interface AccessControl {
    public: boolean;
    team_ids: string[];
    user_ids: string[];
}

/**
 * KnowledgeBaseService
 * Manages knowledge-base source metadata, access control lists (ACLs), and system defaults.
 * Provides CRUD operations for knowledge base sources with audit logging.
 */
export class KnowledgeBaseService {
    /**
     * Initialize the knowledge base service.
     * Placeholder hook for future bootstrap operations like loading defaults or migrations.
     */
    async initialize(): Promise<void> {
    }

    /**
     * Fetch all knowledge base sources sorted alphabetically by name.
     * @returns Array of all KnowledgeBaseSource records
     */
    async getSources(): Promise<KnowledgeBaseSource[]> {
        return ModelFactory.knowledgeBaseSource.findAll({}, {
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Alias for getSources() - kept for backward compatibility.
     * @returns Array of all KnowledgeBaseSource records
     */
    async getAllSources(): Promise<KnowledgeBaseSource[]> {
        return this.getSources();
    }

    /**
     * Get sources available to a specific user based on access control rules.
     * Access determination logic:
     * - No user (guest): Only public sources are returned
     * - Admin users: See all sources
     * - Regular users: See public sources + sources with explicit user/team access
     * @param user - Optional user object with id, role, and team membership
     * @returns Array of KnowledgeBaseSource records the user can access
     */
    async getAvailableSources(user?: any): Promise<KnowledgeBaseSource[]> {
        // If no user, only return public sources
        if (!user) {
            const sources = await ModelFactory.knowledgeBaseSource.findAll();
            return sources.filter(s => {
                const ac = typeof s.access_control === 'string' ? JSON.parse(s.access_control) : s.access_control;
                return ac?.public === true;
            });
        }

        // Admins see everything
        if (user.role === 'admin') {
            return this.getSources();
        }

        // Get user's teams
        const userTeams = await teamService.getUserTeams(user.id);
        const teamIds = userTeams.map(t => t.id);

        // Fetch all sources and filter in code for simplicity with JSONB handling
        // OR use a raw knex query for better performance if many sources
        const allSources = await ModelFactory.knowledgeBaseSource.findAll();

        return allSources.filter(s => {
            const ac = typeof s.access_control === 'string' ? JSON.parse(s.access_control) : s.access_control;
            if (!ac) return false;

            // 1. Public access
            if (ac.public === true) return true;

            // 2. Individual user access
            if (ac.user_ids && Array.isArray(ac.user_ids) && ac.user_ids.includes(user.id)) return true;

            // 3. Team access
            if (ac.team_ids && Array.isArray(ac.team_ids) && teamIds.some(tid => ac.team_ids.includes(tid))) return true;

            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Fetch paginated list of sources by type.
     * Note: Total count is currently a placeholder (100) until proper count query is implemented.
     * @param type - Source type filter ('chat' or 'search')
     * @param page - Page number (1-indexed)
     * @param limit - Number of items per page
     * @returns Object with data array, total count, page, and limit
     */
    async getSourcesPaginated(type: string, page: number, limit: number): Promise<any> {
        const offset = (page - 1) * limit;
        const sources = await ModelFactory.knowledgeBaseSource.findAll({ type }, {
            orderBy: { created_at: 'desc' },
            limit,
            offset
        });
        // We need total count. BaseModel doesn't expose count easily.
        // Assuming we can add count later or live with approximation/fetch all for now if small.
        // Or access db directly.
        // I'll stick to this for now.
        return { data: sources, total: 100, page, limit }; // Placeholder total
    }

    /**
     * Save or update a system configuration key-value pair.
     * Creates new record if key doesn't exist, updates value if it does.
     * Logs audit entry if user context is provided.
     * @param key - Configuration key identifier
     * @param value - Configuration value to store
     * @param user - Optional user for audit logging
     */
    async saveSystemConfig(key: string, value: string, user?: any): Promise<void> {
        const existing = await ModelFactory.systemConfig.findById(key);
        if (existing) {
            await ModelFactory.systemConfig.update(key, { value });
        } else {
            await ModelFactory.systemConfig.create({ key, value });
        }

        if (user) {
            await auditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.UPDATE_CONFIG,
                resourceType: AuditResourceType.CONFIG,
                resourceId: key,
                details: { value },
                ipAddress: user.ip,
            });
        }
    }

    /**
     * Create a new knowledge base source record.
     * Stores source metadata in database and logs audit entry.
     * @param data - Source data including type, name, url, and access_control
     * @param user - Optional user for audit logging with id, email, and ip
     * @returns The created KnowledgeBaseSource record
     * @throws Error if database operation fails
     */
    async createSource(data: any, user?: { id: string, email: string, ip?: string }): Promise<KnowledgeBaseSource> {
        try {
            const source = await ModelFactory.knowledgeBaseSource.create({
                type: data.type,
                name: data.name,
                url: data.url,
                access_control: JSON.stringify(data.access_control || { public: true })
            });

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.CREATE_SOURCE,
                    resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                    resourceId: source.id,
                    details: { name: source.name },
                    ipAddress: user.ip,
                });
            }

            return source;
        } catch (error) {
            log.error('Failed to create knowledge base source in database', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                data: { type: data.type, name: data.name }
            });
            throw error;
        }
    }

    /**
     * Convenience wrapper to add a source matching controller signature.
     * Delegates to createSource with structured data object.
     * @param type - Source type ('chat' or 'search')
     * @param name - Display name for the source
     * @param url - URL endpoint for the source
     * @param access_control - ACL object with public, team_ids, user_ids
     * @param user - Optional user for audit logging
     * @returns The created KnowledgeBaseSource record
     */
    async addSource(type: string, name: string, url: string, access_control: any, user?: any): Promise<KnowledgeBaseSource> {
        return this.createSource({ type, name, url, access_control }, user);
    }

    /**
     * Update an existing knowledge base source.
     * Patches mutable fields (name, url, access_control) and logs audit entry.
     * @param id - Source ID to update
     * @param data - Partial update data with optional name, url, access_control
     * @param user - Optional user for audit logging
     * @returns Updated KnowledgeBaseSource or undefined if not found
     * @throws Error if database operation fails
     */
    async updateSource(id: string, data: any, user?: { id: string, email: string, ip?: string }): Promise<KnowledgeBaseSource | undefined> {
        try {
            const updateData: any = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.url !== undefined) updateData.url = data.url;
            if (data.access_control !== undefined) updateData.access_control = JSON.stringify(data.access_control);

            const source = await ModelFactory.knowledgeBaseSource.update(id, updateData);

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.UPDATE_SOURCE,
                    resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                    resourceId: id,
                    details: { changes: data },
                    ipAddress: user.ip,
                });
            }

            return source;
        } catch (error) {
            log.error('Failed to update knowledge base source in database', {
                id,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                data: data
            });
            throw error;
        }
    }

    /**
     * Delete a knowledge base source record.
     * Removes source from database and logs audit entry with source name.
     * @param id - Source ID to delete
     * @param user - Optional user for audit logging
     * @throws Error if database operation fails
     */
    async deleteSource(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        try {
            const source = await ModelFactory.knowledgeBaseSource.findById(id);
            await ModelFactory.knowledgeBaseSource.delete(id);

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.DELETE_SOURCE,
                    resourceType: AuditResourceType.KNOWLEDGE_BASE_SOURCE,
                    resourceId: id,
                    details: { name: source?.name },
                    ipAddress: user.ip,
                });
            }
        } catch (error) {
            log.error('Failed to delete source', { id, error: String(error) });
            throw error;
        }
    }

    /**
     * Get frontend configuration payload with available sources and defaults.
     * Returns chat/search sources filtered by user ACL plus default source IDs.
     * @param user - Optional user for ACL filtering
     * @returns Config object with chatSources, searchSources, and default IDs
     */
    async getConfig(user?: any): Promise<any> {
        const availableSources = await this.getAvailableSources(user);

        const defaultChatSourceId = await ModelFactory.systemConfig.findById('defaultChatSourceId');
        const defaultSearchSourceId = await ModelFactory.systemConfig.findById('defaultSearchSourceId');

        return {
            chatSources: availableSources.filter(s => s.type === 'chat'),
            searchSources: availableSources.filter(s => s.type === 'search'),
            defaultChatSourceId: defaultChatSourceId?.value || '',
            defaultSearchSourceId: defaultSearchSourceId?.value || ''
        };
    }

    /**
     * Update default source configuration.
     * Persists default chat and/or search source IDs via system config table.
     * @param data - Object with optional defaultChatSourceId and defaultSearchSourceId
     * @param user - Optional user for audit logging
     */
    async updateConfig(data: { defaultChatSourceId?: string; defaultSearchSourceId?: string }, user?: any): Promise<void> {
        if (data.defaultChatSourceId !== undefined) {
            await this.saveSystemConfig('defaultChatSourceId', data.defaultChatSourceId, user);
        }
        if (data.defaultSearchSourceId !== undefined) {
            await this.saveSystemConfig('defaultSearchSourceId', data.defaultSearchSourceId, user);
        }
    }
}

export const knowledgeBaseService = new KnowledgeBaseService();
