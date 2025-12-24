
import { Langfuse } from 'langfuse';
import { config } from '@/config/index.js';

class LangfuseSingleton {
  private static instance: Langfuse;

  private constructor() { }

  public static getInstance(): Langfuse {
    if (!LangfuseSingleton.instance) {
      LangfuseSingleton.instance = new Langfuse({
        secretKey: config.langfuse.secretKey,
        publicKey: config.langfuse.publicKey,
        baseUrl: config.langfuse.baseUrl,
      });
    }
    return LangfuseSingleton.instance;
  }
}

export const langfuseClient = LangfuseSingleton.getInstance();
