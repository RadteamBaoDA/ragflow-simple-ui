/**
 * @fileoverview Shared middleware for external routes.
 * 
 * This module contains middleware that is shared across external routes
 * to avoid circular dependency issues.
 */

import { Request, Response } from 'express';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';

/**
 * Middleware to check if external trace API is enabled.
 */
export function checkEnabled(_req: Request, res: Response, next: () => void): void {
    if (!config.externalTrace.enabled) {
        log.warn('External trace API is disabled');
        res.status(503).json({
            success: false,
            error: 'External trace API is not enabled'
        });
        return;
    }
    next();
};
