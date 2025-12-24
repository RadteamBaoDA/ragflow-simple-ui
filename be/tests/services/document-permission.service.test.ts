
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { documentPermissionService, PermissionLevel } from '../../src/services/document-permission.service.js';
import { query } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.service.js';

// Mock dependencies
vi.mock('../../src/db/index.js');
vi.mock('../../src/services/logger.service.js');
vi.mock('../../src/services/audit.service.js');

describe('DocumentPermissionService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('setPermission', () => {
        it('should set permission and log audit event when actor is provided', async () => {
            const actor = { id: 'admin1', email: 'admin@example.com' };
            vi.mocked(query).mockResolvedValue({} as any);

            await documentPermissionService.setPermission('user', 'user1', 'bucket1', PermissionLevel.VIEW, actor);

            expect(query).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: actor.id,
                action: 'set_permission',
                resourceId: 'user:user1:bucket1',
                details: { entityType: 'user', entityId: 'user1', bucketId: 'bucket1', level: PermissionLevel.VIEW }
            }));
        });
    });
});
