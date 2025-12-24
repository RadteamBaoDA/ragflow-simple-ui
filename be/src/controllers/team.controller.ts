
import { Request, Response } from 'express';
import { teamService } from '../services/team.service.js';
import { log } from '../services/logger.service.js';
import { getClientIp } from '../utils/ip.js';

export class TeamController {
  async getTeams(req: Request, res: Response): Promise<void> {
    try {
      const teams = await teamService.getAllTeams();
      res.json(teams);
    } catch (error) {
      log.error('Failed to fetch teams', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      const team = await teamService.createTeam(req.body, user);
      res.status(201).json(team);
    } catch (error) {
      log.error('Failed to create team', { error: String(error) });
      res.status(500).json({ error: 'Failed to create team' });
    }
  }

  async updateTeam(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' });
      return;
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      const team = await teamService.updateTeam(id, req.body, user);
      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      res.json(team);
    } catch (error) {
      log.error('Failed to update team', { error: String(error) });
      res.status(500).json({ error: 'Failed to update team' });
    }
  }

  async deleteTeam(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Team ID is required' });
      return;
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      await teamService.deleteTeam(id, user);
      res.status(204).send();
    } catch (error) {
      log.error('Failed to delete team', { error: String(error) });
      res.status(500).json({ error: 'Failed to delete team' });
    }
  }

  async getTeamMembers(req: Request, res: Response): Promise<void> {
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
  }

  async addMembers(req: Request, res: Response): Promise<any> {
    try {
      const teamId = req.params.id;
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' });
      }

      const { userId, userIds } = req.body;
      const idsToAdd = userIds || (userId ? [userId] : []);

      if (idsToAdd.length === 0) {
        return res.status(400).json({ error: 'User ID(s) are required' });
      }

      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      await teamService.addMembersWithAutoRole(teamId, idsToAdd, user);
      return res.status(201).json({ message: 'Member(s) added successfully' });
    } catch (error: any) {
      const message = String(error.message || error);
      log.error('Error adding team member:', { error: message });

      if (message.includes('Administrators cannot be added')) {
        return res.status(400).json({ error: 'Administrators cannot be added to teams' });
      }
      if (message.includes('No valid users found') || message.includes('User not found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: 'Failed to add team member' });
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const { id, userId } = req.params;
    if (!id || !userId) {
      res.status(400).json({ error: 'Team ID and User ID are required' });
      return;
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      await teamService.removeUserFromTeam(id, userId, user);
      res.status(204).send();
    } catch (error) {
      log.error('Failed to remove member from team', { error: String(error) });
      res.status(500).json({ error: 'Failed to remove member from team' });
    }
  }

  async grantPermissions(req: Request, res: Response): Promise<void> {
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
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      await teamService.grantPermissionsToTeam(id, permissions, user);
      res.json({ message: 'Permissions granted successfully' });
    } catch (error) {
      log.error('Failed to grant permissions to team', { error: String(error) });
      res.status(500).json({ error: 'Failed to grant permissions' });
    }
  }
}
