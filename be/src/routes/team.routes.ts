/**
 * @fileoverview Team management routes.
 */

import { Router, Request, Response } from 'express';
import { teamService } from '../services/team.service.js';
import { requirePermission, requireRecentAuth } from '../middleware/auth.middleware.js';
import { log } from '../services/logger.service.js';

const router = Router();

// List all teams
router.get('/', requirePermission('manage_users'), async (req: Request, res: Response) => {
    try {
        const teams = await teamService.getAllTeams();
        res.json(teams);
    } catch (error) {
        log.error('Failed to fetch teams', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Create team
router.post('/', requirePermission('manage_users'), async (req: Request, res: Response) => {
    try {
        const team = await teamService.createTeam(req.body);
        res.status(201).json(team);
    } catch (error) {
        log.error('Failed to create team', { error: String(error) });
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update team
router.put('/:id', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Team ID is required' });
        return;
    }
    try {
        const team = await teamService.updateTeam(id, req.body);
        if (!team) {
            res.status(404).json({ error: 'Team not found' });
            return;
        }
        res.json(team);
    } catch (error) {
        log.error('Failed to update team', { error: String(error) });
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Delete team
router.delete('/:id', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Team ID is required' });
        return;
    }
    try {
        await teamService.deleteTeam(id);
        res.status(204).send();
    } catch (error) {
        log.error('Failed to delete team', { error: String(error) });
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// Get team members
router.get('/:id/members', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Team ID is required' });
        return;
    }
    try {
        const members = await teamService.getTeamMembers(id);
        res.json(members);
    } catch (error) {
        log.error('Failed to fetch team members', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

// Add member to team
// Add member(s) to a team
router.post('/:id/members', requirePermission('manage_users'), async (req: Request, res: Response) => {
    try {
        const teamId = req.params.id;
        if (!teamId) {
            return res.status(400).json({ error: 'Team ID is required' });
        }

        const { userId, userIds } = req.body;
        // Support both single userId (legacy/fallback) and array of userIds
        const idsToAdd = userIds || (userId ? [userId] : []);

        if (idsToAdd.length === 0) {
            return res.status(400).json({ error: 'User ID(s) are required' });
        }

        await teamService.addMembersWithAutoRole(teamId, idsToAdd);
        res.status(201).json({ message: 'Member(s) added successfully' });
    } catch (error: any) {
        const message = String(error.message || error);
        log.error('Error adding team member:', { error: message });

        if (message.includes('Administrators cannot be added')) {
            return res.status(400).json({ error: 'Administrators cannot be added to teams' });
        }
        if (message.includes('No valid users found') || message.includes('User not found')) {
            return res.status(404).json({ error: message });
        }
        res.status(500).json({ error: 'Failed to add team member' });
    }
});

// Remove member from team
router.delete('/:id/members/:userId', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id, userId } = req.params;
    if (!id || !userId) {
        res.status(400).json({ error: 'Team ID and User ID are required' });
        return;
    }
    try {
        await teamService.removeUserFromTeam(id, userId);
        res.status(204).send();
    } catch (error) {
        log.error('Failed to remove member from team', { error: String(error) });
        res.status(500).json({ error: 'Failed to remove member from team' });
    }
});

// Grant permissions to team members
router.post('/:id/permissions', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!id) {
        res.status(400).json({ error: 'Team ID is required' });
        return;
    }
    if (!permissions || !Array.isArray(permissions)) {
        res.status(400).json({ error: 'Permissions array is required' });
        return;
    }

    try {
        await teamService.grantPermissionsToTeam(id, permissions);
        res.json({ message: 'Permissions granted successfully' });
    } catch (error) {
        log.error('Failed to grant permissions to team', { error: String(error) });
        res.status(500).json({ error: 'Failed to grant permissions' });
    }
});

export default router;
