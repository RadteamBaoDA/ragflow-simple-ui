
import { Request, Response } from 'express';
import { authService } from '@/services/auth.service.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';

export class AuthController {
    /**
     * Handles user login via username and password.
     *
     * @param req - The Express request object, containing credentials in the body.
     * @param res - The Express response object.
     * @returns A promise that resolves when the response is sent.
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                res.status(400).json({ error: 'Username and password are required' });
                return;
            }

            const result = await authService.login(username, password, getClientIp(req));

            // Set session cookie
            if (req.session) {
                req.session.user = result.user;
            }

            res.json(result);
        } catch (error) {
            log.error('Login failed', { error: String(error) });
            res.status(401).json({ error: 'Invalid credentials' });
        }
    }

    /**
     * Handles user logout by destroying the session.
     *
     * @param req - The Express request object.
     * @param res - The Express response object.
     * @returns A promise that resolves when the response is sent.
     */
    async logout(req: Request, res: Response): Promise<void> {
        try {
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        log.error('Session destruction failed', { error: String(err) });
                    }
                });
            }
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            log.error('Logout failed', { error: String(error) });
            res.status(500).json({ error: 'Logout failed' });
        }
    }

    /**
     * Handles the OAuth callback (placeholder).
     *
     * @param req - The Express request object.
     * @param res - The Express response object.
     * @returns A promise that resolves when the response is sent.
     */
    async callback(req: Request, res: Response): Promise<void> {
        // Implementation for OAuth callback if needed
        res.status(501).json({ message: 'Not implemented yet' });
    }
}
