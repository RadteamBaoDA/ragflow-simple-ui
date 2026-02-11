
import 'express-session';
import { User as DBUser } from '@/shared/models/types.js';

declare module 'express-session' {
  interface SessionData {
    user: DBUser;
    oauthState?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    lastAuthAt?: number;
    lastReauthAt?: number;
  }
}

declare global {
  namespace Express {
    // Extend the default empty User interface
    interface User extends DBUser { }

    interface Request {
      user?: User;
    }
  }
}
