
// Singleton MinIO client configured from environment for reuse across services.
import * as Minio from 'minio';
import { config } from '@/config/index.js';

class MinioSingleton {
  private static instance: Minio.Client;

  private constructor() { }

  // Lazily create/reuse MinIO client using env/override values
  public static getInstance(): Minio.Client {
    if (!MinioSingleton.instance) {
      MinioSingleton.instance = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
      });
    }
    return MinioSingleton.instance;
  }
}

export const minioClient = MinioSingleton.getInstance();
