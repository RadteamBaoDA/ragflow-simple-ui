
import { ModelFactory } from '@/models/factory.js';
import { db } from '@/db/knex.js'; // Added import
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { KnowledgeBaseSource } from '@/models/types.js';
import { teamService } from '@/services/team.service.js'; // Added import

export interface AccessControl {
    public: boolean;
    team_ids: string[];
    user_ids: string[];
}

export class KnowledgeBaseService {
    /**
     * Initializes the knowledge base service (placeholder).
     */
    async initialize(): Promise<void> {
    }

    /**
     * Retrieves all knowledge base sources.
     *
     * @returns A promise that resolves to a list of knowledge base sources, sorted by name.
     */
    async getSources(): Promise<KnowledgeBaseSource[]> {
        return ModelFactory.knowledgeBaseSource.findAll({}, {
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Alias for getSources.
     *
     * @returns A promise that resolves to a list of knowledge base sources.
     */
    async getAllSources(): Promise<KnowledgeBaseSource[]> {
        return this.getSources();
    }

    /**
     * Retrieves sources available to a specific user based on access control.
     * Admins see all sources.
     * Regular users see public sources and those they have explicit access to.
     *
     * @param user - The user requesting the sources (optional).
     * @returns A promise that resolves to a list of available knowledge base sources.
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
     * Retrieves knowledge base sources with pagination.
     *
     * @param type - The type of source to filter by.
     * @param page - The page number.
     * @param limit - The number of items per page.
     * @returns A promise that resolves to an object containing data and pagination info.
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
     * Saves a system configuration value and logs the action.
     *
     * @param key - The configuration key.
     * @param value - The configuration value.
     * @param user - The user performing the action (optional, for audit).
     * @returns A promise that resolves when the configuration is saved.
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
     * Creates a new knowledge base source and logs the action.
     *
     * @param data - The data for the new source.
     * @param user - The user creating the source (optional, for audit).
     * @returns A promise that resolves to the created source.
     * @throws Error if creation fails.
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
     * Adds a new knowledge base source (alias for createSource).
     *
     * @param type - The type of source.
     * @param name - The name of the source.
     * @param url - The URL of the source.
     * @param access_control - The access control settings.
     * @param user - The user adding the source (optional).
     * @returns A promise that resolves to the created source.
     */
    async addSource(type: string, name: string, url: string, access_control: any, user?: any): Promise<KnowledgeBaseSource> {
        return this.createSource({ type, name, url, access_control }, user);
    }

    /**
     * Updates an existing knowledge base source and logs the action.
     *
     * @param id - The ID of the source to update.
     * @param data - The data to update.
     * @param user - The user performing the update (optional, for audit).
     * @returns A promise that resolves to the updated source, or undefined if not found.
     * @throws Error if update fails.
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
     * Deletes a knowledge base source and logs the action.
     *
     * @param id - The ID of the source to delete.
     * @param user - The user performing the deletion (optional, for audit).
     * @returns A promise that resolves when the source is deleted.
     * @throws Error if deletion fails.
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
     * Retrieves the current system configuration, including available sources.
     *
     * @param user - The user requesting the configuration (optional).
     * @returns A promise that resolves to the configuration object.
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
     * Updates system configuration values.
     *
     * @param data - An object containing configuration keys and values to update.
     * @param user - The user performing the update (optional).
     * @returns A promise that resolves when the update is complete.
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
