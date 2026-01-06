
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PromptPermissionService } from '@/services/prompt-permission.service.js';
import { ModelFactory } from '@/models/factory.js';
import { PermissionLevel } from '@/models/types.js';

// Mock ModelFactory
vi.mock('@/models/factory.js', () => ({
    ModelFactory: {
        user: {
            findById: vi.fn(),
        },
        promptPermission: {
            findByEntity: vi.fn(),
        },
        userTeam: {
            findAll: vi.fn(),
            findByUser: vi.fn(),
        },
        team: {
            findById: vi.fn()
        }
    },
}));

describe('PromptPermissionService', () => {
    let service: PromptPermissionService;

    beforeEach(() => {
        service = new PromptPermissionService();
        vi.clearAllMocks();
    });

    it('should return FULL permission for admin', async () => {
        vi.mocked(ModelFactory.user.findById).mockResolvedValue({ role: 'admin' } as any);

        const perm = await service.resolveUserPermission('admin-id');
        expect(perm).toBe(PermissionLevel.FULL);
    });

    it('should return minimal VIEW permission for regular user with no explicit permissions', async () => {
        vi.mocked(ModelFactory.user.findById).mockResolvedValue({ role: 'user' } as any);
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValue(null);
        vi.mocked(ModelFactory.userTeam.findAll).mockResolvedValue([]);

        const perm = await service.resolveUserPermission('user-id');
        expect(perm).toBe(PermissionLevel.VIEW); // This is the key expectation
    });

    it('should return higher permission if explicitly granted to user', async () => {
        vi.mocked(ModelFactory.user.findById).mockResolvedValue({ role: 'user' } as any);
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValue({ permission_level: PermissionLevel.UPLOAD } as any);
        vi.mocked(ModelFactory.userTeam.findAll).mockResolvedValue([]);

        const perm = await service.resolveUserPermission('user-id');
        expect(perm).toBe(PermissionLevel.UPLOAD);
    });
});
