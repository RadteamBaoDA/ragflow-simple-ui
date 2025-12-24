
import { Request, Response } from 'express';
import { userService } from '../services/user.service.js';
import { log } from '../services/logger.service.js';
import { getClientIp } from '../utils/ip.js';

export class UserController {
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      log.error('Failed to fetch users', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      const newUser = await userService.createUser(req.body, user);
      res.status(201).json(newUser);
    } catch (error) {
      log.error('Failed to create user', { error: String(error) });
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      const updatedUser = await userService.updateUser(id, req.body, user);
      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(updatedUser);
    } catch (error) {
      log.error('Failed to update user', { error: String(error) });
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    try {
      const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
      await userService.deleteUser(id, user);
      res.status(204).send();
    } catch (error) {
      log.error('Failed to delete user', { error: String(error) });
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const user = await userService.getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      log.error('Failed to fetch current user', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch current user' });
    }
  }
}
