/**
 * @fileoverview Shared middleware for external routes.
 * 
 * This module contains middleware that is shared across external routes
 * to avoid circular dependency issues.
 */

import { Request, Response } from 'express'
import { config } from '@/shared/config/index.js'
import { log } from '@/shared/services/logger.service.js'

/**
 * Middleware to check if external trace API is enabled.
 * Returns 503 Service Unavailable if the feature flag is disabled.
 * Protects external endpoints from accidental exposure when feature is off.
 * @param _req - Express request object (unused)
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function checkEnabled(_req: Request, res: Response, next: () => void): void {
    // Check if external trace API is enabled via configuration
    if (!config.externalTrace.enabled) {
        // Log warning for monitoring and debugging
        log.warn('External trace API is disabled')

        // Return 503 Service Unavailable with descriptive error
        res.status(503).json({
            success: false,
            error: 'External trace API is not enabled'
        })
        return
    }

    // Feature is enabled - proceed to next middleware
    next()
};
