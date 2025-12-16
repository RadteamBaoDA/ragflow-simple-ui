/**
 * @fileoverview External trace collection routes.
 * 
 * This module provides API endpoints for external systems to submit
 * trace data for collection via Langfuse.
 * 
 * @module routes/external/trace
 */

import { Router, Request, Response } from 'express';
import cors from 'cors';
import { externalTraceService } from '../../services/external-trace.service.js';
import { config } from '../../config/index.js';
import { log } from '../../services/logger.service.js';
import { checkEnabled } from '../../middleware/external.middleware.js';

//Current router path is /api/external/trace
const router = Router();

// Apply CORS for all routes in this router
// Allow all origins for external trace collection
router.use(cors());

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Request body for collecting trace data.
 */
interface CollectTraceBody {
    email: string;
    message: string;
    role?: 'user' | 'assistant';
    response?: string;
    metadata?: {
        source?: string;
        sessionId?: string;
        chatId?: string;
        timestamp?: string;
        model?: string;
        modelName?: string;
        task?: string;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        tags?: string[];
        [key: string]: unknown;
    };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================



/**
 * Middleware to validate API key if configured.
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
        log.warn('Invalid external trace API key', {
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
 * Handles X-Forwarded-For header for proxied requests.
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
 * POST /api/external/trace
 * 
 * Collect trace data from external systems.
 * 
 * Request body:
 * - email: User's email address (must exist in database)
 * - message: The chat message content
 * - role (optional): 'user' or 'assistant'
 * - response (optional): LLM response content
 * - metadata (optional): Additional metadata about the trace
 *   - source: Source system identifier
 *   - chatId: Chat/conversation ID
 *   - sessionId: Session ID from external system
 *   - model: Model ID
 *   - modelName: Model display name
 *   - task: Task type (llm_response, user_response)
 *   - usage: Token usage info
 *   - tags: Custom tags
 * 
 * Response:
 * - success: boolean
 * - traceId: Langfuse trace ID (on success)
 * - error: Error message (on failure)
 * 
 * Note: Preflight requests (OPTIONS) are handled automatically by the cors middleware
 */
router.post('/', checkEnabled, validateApiKey, async (req: Request, res: Response) => {
    try {
        const { email, message, role, response, metadata } = req.body as CollectTraceBody;

        // Validate required fields
        if (!email || typeof email !== 'string') {
            log.warn('External trace: Missing or invalid email', { email, ip: getClientIp(req) });
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid email'
            });
        }

        if (!message || typeof message !== 'string') {
            log.warn('External trace: Missing or invalid message', { email, ip: getClientIp(req) });
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid message'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            log.warn('External trace: Invalid email format', { email, ip: getClientIp(req) });
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Get client IP
        const ipAddress = getClientIp(req);

        // Collect trace
        const result = await externalTraceService.collectTrace({
            email: email.trim().toLowerCase(),
            message: message.trim(),
            ipAddress,
            ...(role && { role }),
            ...(response && { response }),
            ...(metadata && { metadata })
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                traceId: result.traceId
            });
        } else {
            // Email not in database = 403 Forbidden
            if (result.error?.includes('not registered')) {
                log.warn('External trace: User not found/not registered', { email, error: result.error, ip: ipAddress });
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
        log.error('Error in external trace endpoint', {
            error: error instanceof Error ? error.message : String(error)
        });
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;
