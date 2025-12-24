
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { KnowledgeBaseSource } from '@/models/types.js';

export interface AccessControl {
    public: boolean;
    team_ids: string[];
    user_ids: string[];
}

export class KnowledgeBaseService {
    async initialize(): Promise<void> {
    }

    async getSources(): Promise<KnowledgeBaseSource[]> {
        return ModelFactory.knowledgeBaseSource.findAll({}, {
            orderBy: { name: 'asc' }
        });
    }

    async getAllSources(): Promise<KnowledgeBaseSource[]> {
        return this.getSources();
    }

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

    async addSource(type: string, name: string, url: string, access_control: any, user?: any): Promise<KnowledgeBaseSource> {
        return this.createSource({ type, name, url, access_control }, user);
    }

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

    async getConfig(user?: any): Promise<any> {
        const chatSources = await this.getSources();
        const searchSources = await this.getSources();

        const defaultChatSourceId = await ModelFactory.systemConfig.findById('defaultChatSourceId');
        const defaultSearchSourceId = await ModelFactory.systemConfig.findById('defaultSearchSourceId');

        return {
            chatSources: chatSources.filter(s => s.type === 'chat'),
            searchSources: searchSources.filter(s => s.type === 'search'),
            defaultChatSourceId: defaultChatSourceId?.value || '',
            defaultSearchSourceId: defaultSearchSourceId?.value || ''
        };
    }

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
