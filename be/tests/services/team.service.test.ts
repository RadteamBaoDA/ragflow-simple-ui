
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { teamService } from '../../src/services/team.service.js';
import { query, queryOne } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.service.js';

// Mock dependencies
vi.mock('../../src/db/index.js');
vi.mock('../../src/services/logger.service.js');
vi.mock('../../src/services/audit.service.js');

describe('TeamService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('createTeam', () => {
        it('should create team and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const teamData = { name: 'Team A' };
            const createdTeam = { id: 'team1', ...teamData };
            vi.mocked(queryOne).mockResolvedValue(createdTeam as any);

            const result = await teamService.createTeam(teamData, user);

            expect(result).toEqual(createdTeam);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'create_team',
                resourceId: 'team1'
            }));
        });
    });

    describe('updateTeam', () => {
        it('should update team and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const teamData = { name: 'Team Updated' };
            const updatedTeam = { id: 'team1', ...teamData };
            vi.mocked(queryOne).mockResolvedValue(updatedTeam as any);

            const result = await teamService.updateTeam('team1', teamData, user);

            expect(result).toEqual(updatedTeam);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'update_team',
                resourceId: 'team1'
            }));
        });
    });

    describe('deleteTeam', () => {
        it('should delete team and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const team = { id: 'team1', name: 'Team to Delete' };

            // Mock getTeam (which calls queryOne)
            vi.mocked(queryOne).mockResolvedValueOnce(team as any);
            vi.mocked(query).mockResolvedValue({} as any);

            await teamService.deleteTeam('team1', user);

            expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM teams WHERE id ='), ['team1']);
            expect(query).toHaveBeenCalledWith('DELETE FROM teams WHERE id = $1', ['team1']);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'delete_team',
                resourceId: 'team1',
                details: { teamName: 'Team to Delete' }
            }));
        });
    });

    describe('addUserToTeam', () => {
        it('should add user and log audit event when actor is provided', async () => {
            const actor = { id: 'admin1', email: 'admin@example.com' };
            vi.mocked(query).mockResolvedValue({} as any);

            await teamService.addUserToTeam('team1', 'user2', 'member', actor);

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: actor.id,
                action: 'update_team',
                resourceId: 'team1',
                details: expect.objectContaining({ action: 'add_member', targetUserId: 'user2' })
            }));
        });
    });

    describe('removeUserFromTeam', () => {
        it('should remove user and log audit event when actor is provided', async () => {
            const actor = { id: 'admin1', email: 'admin@example.com' };
            vi.mocked(query).mockResolvedValue({} as any);

            await teamService.removeUserFromTeam('team1', 'user2', actor);

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: actor.id,
                action: 'update_team',
                resourceId: 'team1',
                details: expect.objectContaining({ action: 'remove_member', targetUserId: 'user2' })
            }));
        });
    });
});
