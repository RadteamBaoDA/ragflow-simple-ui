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
import { config } from '../config/index.js';
import { log } from './logger.service.js';

/** Singleton Langfuse client instance */
let langfuseClient: Langfuse | null = null;

/**
 * Get or create the Langfuse client instance.
 * 
 * Uses lazy initialization to create the client only when first needed.
 * The same instance is reused for all subsequent calls.
 * 
 * @returns Langfuse client instance
 * 
 * @example
 * const langfuse = getLangfuseClient();
 * const trace = langfuse.trace({ name: 'chat-interaction' });
 * trace.generation({ input: prompt, output: response });
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    log.debug('Initializing Langfuse client', { baseUrl: config.langfuse.baseUrl });
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
 * This should be called during application shutdown to ensure
 * all pending traces are flushed to the Langfuse server.
 * 
 * @example
 * // In graceful shutdown handler
 * await shutdownLangfuse();
 * process.exit(0);
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    log.info('Shutting down Langfuse client');
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
  }
}

/**
 * Check connectivity to Langfuse server.
 * 
 * @returns true if connected/healthy, false otherwise
 */
export async function checkHealth(): Promise<boolean> {
  // If not configured, it's technically "not healthy" in terms of connectivity
  if (!config.langfuse.publicKey || !config.langfuse.secretKey || !config.langfuse.baseUrl) {
    return false;
  }

  try {
    // The Langfuse JS SDK does not expose a direct 'authCheck' method.
    // To verify both connectivity AND credentials (simulating an SDK interaction),
    // we send a dummy ingestion request. 
    // - If we get 200/201/202, it worked.
    // - If we get 400 (Bad Request), it means Auth passed but payload was empty/invalid (Connection OK).
    // - If we get 401/403, Auth failed.
    if (!getLangfuseClient()) {
      return false;
    }
    const response = await fetch(`${config.langfuse.baseUrl}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.langfuse.publicKey}:${config.langfuse.secretKey}`).toString('base64')}`
      },
      body: JSON.stringify({ batch: [] })
    });

    return response.ok || response.status === 400;
  } catch (error) {
    log.warn('Langfuse health check failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
