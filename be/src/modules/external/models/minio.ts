
/**
 * Singleton MinIO client configured from environment for reuse across services.
 */
import * as Minio from 'minio';
import { config } from '@/shared/config/index.js';

/**
 * MinioSingleton
 * Wrapper class to ensure a single instance of the MinIO client.
 */
class MinioSingleton {
  /** Static instance holder */
  private static instance: Minio.Client;

  /** Private constructor to prevent direct instantiation */
  private constructor() { }

  /**
   * Lazily create/reuse MinIO client using env/override values.
   * @returns Minio.Client - The singleton MinIO client instance.
   * @description Initializes MinIO client with environment variables on first call.
   */
  public static getInstance(): Minio.Client {
    // Check if instance already exists
    if (!MinioSingleton.instance) {
      // Create new instance if not, using env vars or defaults
      MinioSingleton.instance = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
      });
    }
    // Return the singleton instance
    return MinioSingleton.instance;
  }
}

/** Export the singleton instance directly */
export const minioClient = MinioSingleton.getInstance();
