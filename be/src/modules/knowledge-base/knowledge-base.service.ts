
// Manages knowledge-base source metadata, ACLs, and defaults.
import { ModelFactory } from '@/shared/models/factory.js';
import { log } from '@/shared/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/modules/audit/audit.service.js';
import { KnowledgeBaseSource } from '@/shared/models/types.js';
import { teamService } from '@/modules/teams/team.service.js';

import { config } from '@/shared/config/index.js';

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
     * @returns Promise<void>
     * @description Placeholder hook for future bootstrap operations like loading defaults or migrations.
     */
    async initialize(): Promise<void> {
        // Reserved for initialization logic
    }

    /**
     * Fetch all knowledge base sources sorted alphabetically by name.
     * @returns Promise<KnowledgeBaseSource[]> - Array of all KnowledgeBaseSource records.
     * @description Retrieving all sources ordered by name.
     */
    async getSources(): Promise<KnowledgeBaseSource[]> {
        return ModelFactory.knowledgeBaseSource.findAll({}, {
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Alias for getSources() - kept for backward compatibility.
     * @returns Promise<KnowledgeBaseSource[]> - Array of all KnowledgeBaseSource records.
     * @description Delegates to getSources().
     */
    async getAllSources(): Promise<KnowledgeBaseSource[]> {
        return this.getSources();
    }

    /**
     * Get sources available to a specific user based on access control rules.
     * @param user - Optional user object with id, role, and team membership.
     * @returns Promise<KnowledgeBaseSource[]> - Array of accessible sources.
     * @description Filters sources based on public access, user/team ACLs, or admin role.
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

        // Fetch all sources
        const allSources = await ModelFactory.knowledgeBaseSource.findAll();

        // Filter sources based on ACL
        return allSources.filter(s => {
            const ac = typeof s.access_control === 'string' ? JSON.parse(s.access_control) : s.access_control;
            if (!ac) return false;

            // 1. Check Public access
            if (ac.public === true) return true;

            // 2. Check Individual user access
            if (ac.user_ids && Array.isArray(ac.user_ids) && ac.user_ids.includes(user.id)) return true;

            // 3. Check Team access
            if (ac.team_ids && Array.isArray(ac.team_ids) && teamIds.some(tid => ac.team_ids.includes(tid))) return true;

            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Fetch paginated list of sources by type.
     * @param type - Source type filter ('chat' or 'search').
     * @param page - Page number (1-indexed).
     * @param limit - Number of items per page.
     * @returns Promise<any> - Object with data array, total count, page, and limit.
     * @description Retrieves sources of a specific type with pagination.
     */
    async getSourcesPaginated(type: string, page: number, limit: number): Promise<any> {
        const offset = (page - 1) * limit;
        // Fetch paginated sources
        const sources = await ModelFactory.knowledgeBaseSource.findAll({ type }, {
            orderBy: { created_at: 'desc' },
            limit,
            offset
        });

        // Return structured pagination response
        // Note: Total count is hardcoded to 100 as per instruction/limitation
        return { data: sources, total: 100, page, limit };
    }

    /**
     * Save or update a system configuration key-value pair.
     * @param key - Configuration key identifier.
     * @param value - Configuration value to store.
     * @param user - Optional user for audit logging.
     * @returns Promise<void>
     * @description Creates or updates a system config setting and logs the action.
     */
    async saveSystemConfig(key: string, value: string, user?: any): Promise<void> {
        // Check for existing config
        const existing = await ModelFactory.systemConfig.findById(key);

        if (existing) {
            // Update existing record
            await ModelFactory.systemConfig.update(key, { value, updated_by: user?.id || null });
        } else {
            // Create new record
            await ModelFactory.systemConfig.create({
                key,
                value,
                created_by: user?.id || null,
                updated_by: user?.id || null
            });
        }

        // Log audit event
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
     * @param data - Source data including type, name, url, and access_control.
     * @param user - Optional user for audit logging with id, email, and ip.
     * @returns Promise<KnowledgeBaseSource> - The created KnowledgeBaseSource record.
     * @throws Error if database operation fails.
     * @description Creates a new source and logs the creation audit event.
     */
    async createSource(data: any, user?: { id: string, email: string, ip?: string }): Promise<KnowledgeBaseSource> {
        try {
            // Check for duplicate name within the same type (chat or search)
            const existingSource = await ModelFactory.knowledgeBaseSource.getKnex()
                .where('name', data.name)
                .where('type', data.type)
                .first();
            if (existingSource) {
                throw new Error(`Knowledge base source with name "${data.name}" already exists for type "${data.type}"`);
            }

            // Create source in database
            const source = await ModelFactory.knowledgeBaseSource.create({
                type: data.type,
                name: data.name,
                url: data.url,
                description: data.description || null,
                share_id: data.share_id || null,
                chat_widget_url: data.chat_widget_url || null,
                access_control: JSON.stringify(data.access_control || { public: true }),
                created_by: user?.id || null,
                updated_by: user?.id || null
            });

            // Log audit event
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
            // Log error and rethrow
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
     * @param type - Source type ('chat' or 'search').
     * @param name - Display name for the source.
     * @param url - URL endpoint for the source.
     * @param access_control - ACL object with public, team_ids, user_ids.
     * @param user - Optional user for audit logging.
     * @returns Promise<KnowledgeBaseSource> - The created KnowledgeBaseSource record.
     * @description Delegates to createSource with structured data object.
     */
    async addSource(type: string, name: string, url: string, access_control: any, user?: any): Promise<KnowledgeBaseSource> {
        return this.createSource({ type, name, url, access_control }, user);
    }

    /**
     * Update an existing knowledge base source.
     * @param id - Source ID to update.
     * @param data - Partial update data with optional name, url, access_control.
     * @param user - Optional user for audit logging.
     * @returns Promise<KnowledgeBaseSource | undefined> - Updated KnowledgeBaseSource or undefined if not found.
     * @throws Error if database operation fails.
     * @description Patches mutable fields (name, url, access_control) and logs audit entry.
     */
    async updateSource(id: string, data: any, user?: { id: string, email: string, ip?: string }): Promise<KnowledgeBaseSource | undefined> {
        try {
            const updateData: any = {};
            // Gather fields to update
            if (data.name !== undefined) updateData.name = data.name;
            if (data.url !== undefined) updateData.url = data.url;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.share_id !== undefined) updateData.share_id = data.share_id;
            if (data.chat_widget_url !== undefined) updateData.chat_widget_url = data.chat_widget_url;
            if (data.access_control !== undefined) updateData.access_control = JSON.stringify(data.access_control);
            if (user) updateData.updated_by = user.id;

            // Check for duplicate name within the same type (only if name is being changed to a different value)
            if (data.name !== undefined) {
                // Fetch current source to compare names and get type
                const currentSource = await ModelFactory.knowledgeBaseSource.findById(id);
                // Only check duplicates if the name is actually changing
                if (currentSource && data.name !== currentSource.name) {
                    const existingSource = await ModelFactory.knowledgeBaseSource.getKnex()
                        .where('name', data.name)
                        .where('type', currentSource.type)
                        .whereNot('id', id)
                        .first();
                    if (existingSource) {
                        throw new Error(`Knowledge base source with name "${data.name}" already exists for type "${currentSource.type}"`);
                    }
                }
            }

            // Execute update
            const source = await ModelFactory.knowledgeBaseSource.update(id, updateData);

            // Log audit event
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
            // Check if this is a duplicate name validation error (expected user input error)
            const isDuplicateError = error instanceof Error && error.message.includes('already exists');

            if (isDuplicateError) {
                // Log as warning for validation errors
                log.warn('Knowledge base source name already exists', {
                    id,
                    name: data.name,
                });
            } else {
                // Log as error for unexpected failures
                log.error('Failed to update knowledge base source in database', {
                    id,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    data: data
                });
            }
            throw error;
        }
    }

    /**
     * Delete a knowledge base source record.
     * @param id - Source ID to delete.
     * @param user - Optional user for audit logging.
     * @returns Promise<void>
     * @throws Error if database operation fails.
     * @description Removes source from database and logs audit entry.
     */
    async deleteSource(id: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        try {
            // Fetch source for logging details
            const source = await ModelFactory.knowledgeBaseSource.findById(id);
            // Execute deletion
            await ModelFactory.knowledgeBaseSource.delete(id);

            // Log audit event
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
            // Log error and rethrow
            log.error('Failed to delete source', { id, error: String(error) });
            throw error;
        }
    }

    /**
     * Get frontend configuration payload with available sources and defaults.
     * @param user - Optional user for ACL filtering.
     * @returns Promise<any> - Config object with sources and default IDs.
     * @description Returns filtered chat/search sources plus system-wide default selections.
     */
    async getConfig(user?: any): Promise<any> {
        // Get sources accessible to the user
        const availableSources = await this.getAvailableSources(user);

        // Fetch system defaults
        const defaultChatSourceId = await ModelFactory.systemConfig.findById('defaultChatSourceId');
        const defaultSearchSourceId = await ModelFactory.systemConfig.findById('defaultSearchSourceId');

        // Construct config payload
        return {
            chatSources: availableSources.filter(s => s.type === 'chat'),
            searchSources: availableSources.filter(s => s.type === 'search'),
            defaultChatSourceId: defaultChatSourceId?.value || '',
            defaultSearchSourceId: defaultSearchSourceId?.value || '',
            kbBaseUrl: config.kbBaseUrl
        };
    }

    /**
     * Update default source configuration.
     * @param data - Object with optional defaultChatSourceId and defaultSearchSourceId.
     * @param user - Optional user for audit logging.
     * @returns Promise<void>
     * @description Persists default chat and/or search source IDs via system config.
     */
    async updateConfig(data: { defaultChatSourceId?: string; defaultSearchSourceId?: string }, user?: any): Promise<void> {
        // Update default chat source if provided
        if (data.defaultChatSourceId !== undefined) {
            await this.saveSystemConfig('defaultChatSourceId', data.defaultChatSourceId, user);
        }
        // Update default search source if provided
        if (data.defaultSearchSourceId !== undefined) {
            await this.saveSystemConfig('defaultSearchSourceId', data.defaultSearchSourceId, user);
        }
    }
}

export const knowledgeBaseService = new KnowledgeBaseService();
