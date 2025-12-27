
/**
 * Singleton wrapper around Langfuse SDK for downstream services.
 */
import { Langfuse } from 'langfuse';
import { config } from '@/config/index.js';

/**
 * LangfuseSingleton
 * Wrapper class to ensure a single instance of the Langfuse client.
 */
class LangfuseSingleton {
  /** Static instance holder */
  private static instance: Langfuse;

  /** Private constructor to prevent direct instantiation */
  private constructor() { }

  /**
   * Create or return shared Langfuse client configured from central config.
   * @returns Langfuse - The singleton Langfuse client instance.
   * @description Initializes Langfuse with secrets from config on first call.
   */
  public static getInstance(): Langfuse {
    // Check if instance already exists
    if (!LangfuseSingleton.instance) {
      // Create new instance if not
      LangfuseSingleton.instance = new Langfuse({
        secretKey: config.langfuse.secretKey,
        publicKey: config.langfuse.publicKey,
        baseUrl: config.langfuse.baseUrl,
      });
    }
    // Return the singleton instance
    return LangfuseSingleton.instance;
  }
}

/** Export the singleton instance directly */
export const langfuseClient = LangfuseSingleton.getInstance();
