
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PromptPermissionService } from '@/services/prompt-permission.service.js';
import { ModelFactory } from '@/models/factory.js';
import { PermissionLevel } from '@/models/types.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { log } from '@/services/logger.service.js';

// Mock ModelFactory
vi.mock('@/models/factory.js', () => ({
    ModelFactory: {
        user: {
            findById: vi.fn(),
        },
        promptPermission: {
            findByEntity: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findAll: vi.fn()
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

    it('getPermission returns NONE when not found and value when found', async () => {
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValueOnce(undefined);
        const none = await service.getPermission('user', 'u1');
        expect(none).toBe(PermissionLevel.NONE);

        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValueOnce({ permission_level: PermissionLevel.FULL } as any);
        const full = await service.getPermission('user', 'u1');
        expect(full).toBe(PermissionLevel.FULL);
    });

    it('setPermission creates when missing and updates when present and logs audit', async () => {
        // create
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValueOnce(undefined);
        vi.mocked(ModelFactory.promptPermission.create).mockResolvedValue({} as any);
        await service.setPermission('user', 'u1', PermissionLevel.VIEW, { id: 'a', email: 'e' });
        expect(ModelFactory.promptPermission.create).toHaveBeenCalled();

        // update
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValueOnce({ id: 'p1' } as any);
        vi.mocked(ModelFactory.promptPermission.update).mockResolvedValue({} as any);
        await service.setPermission('user', 'u1', PermissionLevel.FULL, { id: 'a', email: 'e' });
        expect(ModelFactory.promptPermission.update).toHaveBeenCalledWith('p1', expect.objectContaining({ permission_level: PermissionLevel.FULL }));
    });

    it('setPermission logs and throws on error', async () => {
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockRejectedValue(new Error('x'));
        const spy = vi.spyOn(log, 'error')
        await expect(service.setPermission('user', 'u1', PermissionLevel.FULL, { id: 'a', email: 'e' })).rejects.toThrow();
        expect(spy).toHaveBeenCalledWith('Failed to set prompt permission', expect.any(Object));
    });

    it('setPermission calls auditService.log when actor provided', async () => {
        vi.mocked(ModelFactory.promptPermission.findByEntity).mockResolvedValueOnce(undefined);
        vi.mocked(ModelFactory.promptPermission.create).mockResolvedValue({} as any);
        const spy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined as any)

        await service.setPermission('user', 'u1', PermissionLevel.VIEW, { id: 'a', email: 'e', ip: '1.1.1.1' })

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'a',
            userEmail: 'e',
            action: AuditAction.SET_PERMISSION,
            resourceType: AuditResourceType.PROMPT,
            resourceId: 'prompt:user:u1'
        }))
    });

    it('getAllPermissions returns promptPermission.findAll', async () => {
        const rows = [{ id: 'p1' }]
        vi.mocked(ModelFactory.promptPermission.findAll).mockResolvedValue(rows as any)

        const res = await service.getAllPermissions()
        expect(ModelFactory.promptPermission.findAll).toHaveBeenCalled()
        expect(res).toEqual(rows)
    })

    it('resolveUserPermission aggregates team permissions', async () => {
        vi.mocked(ModelFactory.user.findById).mockResolvedValue({ role: 'user' } as any)
        vi.mocked(ModelFactory.userTeam.findAll).mockResolvedValue([{ team_id: 't1' }] as any)

        const spy = vi.spyOn(service, 'getPermission')
            .mockImplementation(async (type: string, id: string) => {
                if (type === 'user') return PermissionLevel.VIEW
                if (type === 'team' && id === 't1') return PermissionLevel.UPLOAD
                return PermissionLevel.VIEW
            })

        const res = await service.resolveUserPermission('u1')
        expect(spy).toHaveBeenCalled()
        expect(res).toBe(PermissionLevel.UPLOAD)
    });

});
