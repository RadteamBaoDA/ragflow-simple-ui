/**
 * @fileoverview External feedback collection routes.
 *
 * This module provides API endpoints for external systems to submit
 * user feedback (scores) for traces via Langfuse.
 *
 * @module routes/external/feedback
 */

import { Router, Request, Response } from 'express';
import cors from 'cors';
import { externalFeedbackService } from '../../services/external-feedback.service.js';
import { config } from '../../config/index.js';
import { log } from '../../services/logger.service.js';
import { checkEnabled } from '../../middleware/external.middleware.js';

const router = Router();

// Apply CORS for all routes in this router
router.use(cors());

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Request body for collecting feedback.
 */
interface CollectFeedbackBody {
    email: string;
    traceId: string;
    value: number;
    name?: string;
    comment?: string;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware to validate API key if configured.
 * Duplicated from trace.routes.ts to keep modules independent but consistent.
 */
const validateApiKey = (req: Request, res: Response, next: () => void): void => {
    const apiKey = config.externalTrace.apiKey;

    // Skip if no API key configured
    if (!apiKey) {
        next();
        return;
    }

    const authHeader = req.headers['authorization'];
    const providedKey = req.headers['x-api-key'] || (authHeader ? authHeader.replace('Bearer ', '') : '');

    if (providedKey !== apiKey) {
        log.warn('Invalid external feedback API key', {
            providedKey: providedKey ? '***' : 'none'
        });
        res.status(401).json({
            success: false,
            error: 'Invalid or missing API key'
        });
        return;
    }

    next();
};

/**
 * Extract client IP address from request.
 */
const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        const firstIp = forwarded.split(',')[0];
        return firstIp ? firstIp.trim() : 'unknown';
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        const firstHeader = forwarded[0];
        if (firstHeader) {
            const firstIp = firstHeader.split(',')[0];
            return firstIp ? firstIp.trim() : 'unknown';
        }
    }
    return req.socket.remoteAddress || 'unknown';
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/external/feedback
 *
 * Collect user feedback (scores) for traces.
 *
 * Request body:
 * - email: User's email address (must exist in database)
 * - traceId: Langfuse trace ID to associate feedback with
 * - value: Score value (number)
 * - name (optional): Name of the score (default: user-feedback)
 * - comment (optional): Text comment
 *
 * Response:
 * - success: boolean
 * - error: Error message (on failure)
 */
router.post('/', checkEnabled, validateApiKey, async (req: Request, res: Response) => {
    try {
        const { email, traceId, value, name, comment } = req.body as CollectFeedbackBody;

        // Debug log incoming request
        log.debug('External feedback request received', {
            email: email ? `${email.substring(0, 5)}...` : 'undefined',
            traceId,
            value,
            ip: getClientIp(req),
        });

        // Validate required fields
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid email'
            });
        }

        if (!traceId || typeof traceId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid traceId'
            });
        }

        if (value === undefined || value === null || typeof value !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid value (must be a number)'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Get client IP
        const ipAddress = getClientIp(req);

        // Collect feedback
        const result = await externalFeedbackService.collectFeedback({
            email: email.trim().toLowerCase(),
            traceId,
            value,
            ipAddress,
            ...(name && { name }),
            ...(comment && { comment })
        });

        if (result.success) {
            return res.status(200).json({
                success: true
            });
        } else {
            // Email not in database = 403 Forbidden
            if (result.error?.includes('not registered')) {
                return res.status(403).json({
                    success: false,
                    error: result.error
                });
            }
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        log.error('Error in external feedback endpoint', {
            error: error instanceof Error ? error.message : String(error)
        });
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;
