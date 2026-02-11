/**
 * @fileoverview Langfuse observability service.
 * 
 * This module provides integration with Langfuse for LLM observability.
 * Langfuse is used to trace and log AI chat/search interactions for
 * analytics, debugging, and monitoring purposes.
 * 
 * Features:
 * - Singleton client pattern for efficient resource usage
 * - Lazy initialization to avoid startup errors if Langfuse is not configured
 * - Graceful shutdown to ensure all traces are flushed
 * 
 * @module services/langfuse
 * @see https://langfuse.com/docs
 */

import { Langfuse } from 'langfuse';
import { config } from '@/shared/config/index.js';
import { log } from '@/shared/services/logger.service.js';

/** Singleton Langfuse client instance */
let langfuseClient: Langfuse | null = null;

/**
 * Get or create the Langfuse client instance.
 * 
 * @returns Langfuse - Langfuse client instance.
 * @description Uses lazy initialization to create or return the singleton client.
 * 
 * @example
 * const langfuse = getLangfuseClient();
 * const trace = langfuse.trace({ name: 'chat-interaction' });
 * trace.generation({ input: prompt, output: response });
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    log.debug('Initializing Langfuse client', { baseUrl: config.langfuse.baseUrl });
    // Initialize new client with config credentials
    langfuseClient = new Langfuse({
      secretKey: config.langfuse.secretKey,
      publicKey: config.langfuse.publicKey,
      baseUrl: config.langfuse.baseUrl,
    });
  }
  return langfuseClient;
}

/**
 * Shutdown the Langfuse client gracefully.
 * 
 * @returns Promise<void>
 * @description Flushes pending traces and shuts down the client.
 * 
 * @example
 * // In graceful shutdown handler
 * await shutdownLangfuse();
 * process.exit(0);
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    log.info('Shutting down Langfuse client');
    // Ensure all events are sent before exit
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
  }
}

/**
 * Check connectivity to Langfuse server.
 * 
 * @returns Promise<boolean> - True if connected/healthy, false otherwise.
 * @description Verifies configuration and attempts a dummy ingestion request to check health.
 */
export async function checkHealth(): Promise<boolean> {
  // Check for required configuration keys
  if (!config.langfuse.publicKey || !config.langfuse.secretKey || !config.langfuse.baseUrl) {
    return false;
  }

  try {
    // Ensure client is initialized
    if (!getLangfuseClient()) {
      return false;
    }

    // Send a dummy ingestion request to verify connectivity and auth
    const response = await fetch(`${config.langfuse.baseUrl}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Construct Basic Auth header manually for the test request
        'Authorization': `Basic ${Buffer.from(`${config.langfuse.publicKey}:${config.langfuse.secretKey}`).toString('base64')}`
      },
      body: JSON.stringify({ batch: [] })
    });

    // 2XX is success, 400 means auth passed but payload invalid (still healthy connection)
    return response.ok || response.status === 400;
  } catch (error) {
    // Log failure
    log.warn('Langfuse health check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
