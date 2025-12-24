/**
 * @fileoverview External feedback collection service.
 *
 * This module handles collecting feedback data from external systems with:
 * - Langfuse scoring for observability
 * - Email validation against the database
 *
 * @module services/external-feedback
 */

import { getLangfuseClient } from './langfuse.service.js';
import { externalTraceService } from './external-trace.service.js';
import { log } from './logger.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Parameters for collecting external feedback data.
 */
export interface ExternalFeedbackParams {
    /** User's email address - must exist in database */
    email: string;
    /** Client IP address for caching */
    ipAddress: string;
    /** Langfuse Trace ID to associate feedback with */
    traceId: string;
    /** Score value (e.g., 0-1 for normalized scores, or any number) */
    value: number;
    /** Optional name for the score/feedback (default: user-feedback) */
    name?: string;
    /** Optional comment provided by the user */
    comment?: string;
}

/**
 * Result of collecting feedback data.
 */
export interface CollectFeedbackResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

// ============================================================================
// EXTERNAL FEEDBACK SERVICE CLASS
// ============================================================================

/**
 * Service for collecting feedback data from external systems.
 * Uses Langfuse for scoring and reuses ExternalTraceService for email validation.
 */
export class ExternalFeedbackService {

    /**
     * Collect feedback data from an external system.
     */
    async collectFeedback(params: ExternalFeedbackParams): Promise<CollectFeedbackResult> {
        const { email, ipAddress, traceId, value, name = 'user-feedback', comment } = params;

        log.debug('Collecting external feedback', {
            email,
            traceId,
            value,
            ipAddress: ipAddress.substring(0, 20)
        });

        // Reuse email validation from ExternalTraceService
        const isValidEmail = await externalTraceService.validateEmailWithCache(email, ipAddress);

        if (!isValidEmail) {
            log.warn('External feedback rejected: email not in database', { email });
            return {
                success: false,
                error: 'Invalid email: not registered in system'
            };
        }

        try {
            const langfuse = getLangfuseClient();
            log.debug('Langfuse client obtained', { clientExists: !!langfuse });

            await langfuse.score({
                traceId: traceId,
                name: name,
                value: value,
                comment: comment,
            });

            await langfuse.flushAsync();

            log.info('External feedback collected successfully', {
                email,
                traceId,
                value
            });

            return {
                success: true
            };
        } catch (error) {
            log.error('Failed to collect external feedback', {
                error: error instanceof Error ? error.message : String(error),
                email,
                traceId
            });
            return {
                success: false,
                error: 'Failed to process feedback data'
            };
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton external feedback service instance */
export const externalFeedbackService = new ExternalFeedbackService();
