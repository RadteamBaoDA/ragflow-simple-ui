
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { knowledgeBaseService } from '../../src/services/knowledge-base.service.js';
import { db } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.service.js';

// Mock dependencies
vi.mock('../../src/db/index.js');
vi.mock('../../src/services/logger.service.js');
vi.mock('../../src/services/audit.service.js');

describe('KnowledgeBaseService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('saveSystemConfig', () => {
        it('should update config and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            vi.mocked(db.query).mockResolvedValue({} as any);

            await knowledgeBaseService.saveSystemConfig('default_chat_source_id', 'source1', user);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO system_configs'),
                ['default_chat_source_id', 'source1']
            );
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'update_config',
                details: { value: 'source1' }
            }));
        });
    });

    describe('addSource', () => {
        it('should add source and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            vi.mocked(db.query).mockResolvedValue({} as any);

            await knowledgeBaseService.addSource('chat', 'Chat Source', 'http://example.com', undefined, user);

            expect(db.query).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'create_source',
                resourceType: 'knowledge_base_source'
            }));
        });
    });

    describe('updateSource', () => {
        it('should update source and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            vi.mocked(db.query).mockResolvedValue({} as any);

            await knowledgeBaseService.updateSource('source1', 'Updated Name', 'http://example.com', undefined, user);

            expect(db.query).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'update_source',
                resourceId: 'source1'
            }));
        });
    });

    describe('deleteSource', () => {
        it('should delete source and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            vi.mocked(db.queryOne).mockResolvedValue({ name: 'Source to delete' } as any);
            vi.mocked(db.query).mockResolvedValue({} as any);

            await knowledgeBaseService.deleteSource('source1', user);

            expect(db.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('SELECT name FROM knowledge_base_sources'),
                ['source1']
            );
            expect(db.query).toHaveBeenCalledWith(
                'DELETE FROM knowledge_base_sources WHERE id = $1',
                ['source1']
            );
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'delete_source',
                resourceId: 'source1',
                details: { name: 'Source to delete' }
            }));
        });
    });
});
