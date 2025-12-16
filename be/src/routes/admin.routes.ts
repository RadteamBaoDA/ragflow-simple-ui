/**
 * @fileoverview Administrative routes for system management.
 * 
 * This module provides API endpoints for administrative operations
 * that require special API key authentication (not regular user auth).
 * 
 * Security:
 * - All routes require X-Admin-API-Key header
 * - API key must match ADMIN_API_KEY environment variable
 * - These routes are for DevOps/admin scripts, not regular users
 * 
 * Session Security Features:
 * - Logout all users (incident response)
 * - Revoke specific user sessions (targeted response)
 * - Count active sessions (monitoring)
 * 
 * @module routes/admin
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SessionData } from 'express-session';
import { log } from '../services/logger.service.js';

const router = Router();

// ============================================================================
// Admin Authentication Middleware
// ============================================================================

/**
 * Middleware to validate admin API key.
 * 
 * Checks X-Admin-API-Key header against ADMIN_API_KEY env variable.
 * Returns 401 if invalid, 500 if not configured.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-admin-api-key'];
    const configuredKey = process.env.ADMIN_API_KEY;

    // Ensure admin API key is configured
    if (!configuredKey) {
        log.error('Admin API key not configured');
        res.status(500).json({ error: 'Admin API not configured' });
        return;
    }

    // Validate provided key
    if (apiKey !== configuredKey) {
        log.warn('Invalid admin API key attempt', { ip: req.ip });
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    next();
};

/** Apply admin authentication to all routes */
router.use(requireAdminKey);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/admin/logout-all
 * Force logout all users by clearing the session store.
 * 
 * Use cases:
 * - Security incident response
 * - Force re-authentication after permission changes
 * - System maintenance
 * 
 * @returns {Object} Success message
 * @returns {500} If session store doesn't support clear operation
 */
router.post('/logout-all', (req: Request, res: Response) => {
    log.warn('Admin initiated global logout (clearing session store)');

    // Verify session store supports clear operation
    if (!req.sessionStore || !req.sessionStore.clear) {
        log.error('Session store does not support clear operation');
        res.status(500).json({ error: 'Session store does not support this operation' });
        return;
    }

    // Clear all sessions
    req.sessionStore.clear((err) => {
        if (err) {
            log.error('Failed to clear session store', { error: err.message });
            res.status(500).json({ error: 'Failed to clear sessions' });
            return;
        }

        log.info('All sessions cleared successfully');
        res.json({ message: 'All users have been logged out' });
    });
});

/**
 * POST /api/admin/sessions/:userId/revoke
 * Revoke all sessions for a specific user.
 * 
 * This endpoint iterates through the session store and destroys
 * all sessions belonging to the specified user ID.
 * 
 * Use cases:
 * - Compromised account response
 * - User deactivation
 * - Force re-login after role change
 * 
 * Security: Per OWASP Session Management Cheat Sheet:
 * "Provide the ability to revoke sessions on the server side"
 * 
 * @param userId - The user ID whose sessions should be revoked
 * @returns {Object} Success message with count of revoked sessions
 * @returns {500} If session store doesn't support required operations
 */
router.post('/sessions/:userId/revoke', async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
        res.status(400).json({ error: 'User ID is required' });
        return;
    }

    log.warn('Admin initiated session revocation', { targetUserId: userId });

    // Check if session store supports 'all' operation
    const sessionStore = req.sessionStore as {
        all?: (callback: (err: Error | null, sessions?: Record<string, SessionData>) => void) => void;
        destroy?: (sid: string, callback?: (err?: Error) => void) => void;
    };

    if (!sessionStore.all || !sessionStore.destroy) {
        log.error('Session store does not support session enumeration');
        res.status(500).json({
            error: 'Session store does not support session revocation',
            hint: 'Use Redis or a compatible session store for this feature'
        });
        return;
    }

    try {
        // Get all sessions
        const allSessions = await new Promise<Record<string, SessionData>>((resolve, reject) => {
            sessionStore.all!((err, sessions) => {
                if (err) reject(err);
                else resolve(sessions ?? {});
            });
        });

        // Find and destroy sessions belonging to the user
        const sessionIds = Object.keys(allSessions);
        let revokedCount = 0;
        const errors: string[] = [];

        for (const sid of sessionIds) {
            const session = allSessions[sid];
            // Check if session belongs to the target user
            // Session data structure: { user?: { id: string, ... }, ... }
            const sessionUser = session?.user as { id?: string } | undefined;

            if (sessionUser?.id === userId) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        sessionStore.destroy!(sid, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    revokedCount++;
                    log.debug('Revoked session', { sessionId: sid.substring(0, 8), userId });
                } catch (destroyErr) {
                    const errMsg = destroyErr instanceof Error ? destroyErr.message : String(destroyErr);
                    errors.push(errMsg);
                    log.error('Failed to destroy session', {
                        sessionId: sid.substring(0, 8),
                        error: errMsg
                    });
                }
            }
        }

        log.info('Session revocation completed', {
            targetUserId: userId,
            revokedCount,
            totalSessions: sessionIds.length,
            errorCount: errors.length
        });

        res.json({
            message: `Revoked ${revokedCount} session(s) for user`,
            userId,
            revokedCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error('Session revocation failed', { error: errMsg, userId });
        res.status(500).json({ error: 'Failed to revoke sessions' });
    }
});

/**
 * GET /api/admin/sessions/stats
 * Get session statistics for monitoring.
 * 
 * Returns counts and optionally session details for active sessions.
 * Useful for security monitoring and capacity planning.
 * 
 * @query {boolean} [details=false] - Include per-user session counts
 * @returns {Object} Session statistics
 * @returns {500} If session store doesn't support required operations
 */
router.get('/sessions/stats', async (req: Request, res: Response) => {
    const includeDetails = req.query['details'] === 'true';

    log.debug('Session stats requested', { includeDetails });

    // Check if session store supports 'all' operation
    const sessionStore = req.sessionStore as {
        all?: (callback: (err: Error | null, sessions?: Record<string, SessionData>) => void) => void;
        length?: (callback: (err: Error | null, length?: number) => void) => void;
    };

    // Try to get session count first (more efficient)
    if (sessionStore.length && !includeDetails) {
        try {
            const count = await new Promise<number>((resolve, reject) => {
                sessionStore.length!((err, length) => {
                    if (err) reject(err);
                    else resolve(length ?? 0);
                });
            });

            res.json({
                totalSessions: count,
                timestamp: new Date().toISOString(),
            });
            return;
        } catch (err) {
            log.debug('Session count failed, trying enumeration', {
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    if (!sessionStore.all) {
        res.status(500).json({
            error: 'Session store does not support session statistics',
            hint: 'Use Redis or a compatible session store for this feature'
        });
        return;
    }

    try {
        const allSessions = await new Promise<Record<string, SessionData>>((resolve, reject) => {
            sessionStore.all!((err, sessions) => {
                if (err) reject(err);
                else resolve(sessions ?? {});
            });
        });

        const sessionIds = Object.keys(allSessions);
        const userSessionCounts: Record<string, number> = {};
        let anonymousSessions = 0;

        for (const sid of sessionIds) {
            const session = allSessions[sid];
            const sessionUser = session?.user as { id?: string; email?: string } | undefined;

            if (sessionUser?.id) {
                const key = sessionUser.email || sessionUser.id;
                userSessionCounts[key] = (userSessionCounts[key] ?? 0) + 1;
            } else {
                anonymousSessions++;
            }
        }

        const stats: Record<string, unknown> = {
            totalSessions: sessionIds.length,
            authenticatedSessions: sessionIds.length - anonymousSessions,
            anonymousSessions,
            uniqueUsers: Object.keys(userSessionCounts).length,
            timestamp: new Date().toISOString(),
        };

        if (includeDetails) {
            stats['userSessions'] = userSessionCounts;
        }

        res.json(stats);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error('Session stats failed', { error: errMsg });
        res.status(500).json({ error: 'Failed to get session statistics' });
    }
});

export default router;
