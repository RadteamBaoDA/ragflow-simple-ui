
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis'; // Fixed named import
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as http from 'http';
import * as https from 'https';
import rateLimit from 'express-rate-limit';

import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { initRedis, getRedisClient, getRedisStatus, shutdownRedis } from '@/services/redis.service.js';
import { db, getAdapter, checkConnection, closePool } from '@/db/index.js';
import { runMigrations } from '@/db/migrations/runner.js';
import { cronService } from '@/services/cron.service.js';
import { knowledgeBaseService } from '@/services/knowledge-base.service.js';
import { systemToolsService } from '@/services/system-tools.service.js';
import { userService } from '@/services/user.service.js';
import { shutdownLangfuse } from '@/services/langfuse.service.js';
import { externalTraceService } from '@/services/external-trace.service.js';
import { queueService } from '@/services/queue.service.js';

import authRoutes from '@/routes/auth.routes.js';
import knowledgeBaseRoutes from '@/routes/knowledge-base.routes.js';
import adminRoutes from '@/routes/admin.routes.js';
import userRoutes from '@/routes/user.routes.js';
import teamRoutes from '@/routes/team.routes.js';
import systemToolsRoutes from '@/routes/system-tools.routes.js';
import minioBucketRoutes from '@/routes/minio-bucket.routes.js';
import minioRawRoutes from '@/routes/minio-raw.routes.js';
import minioStorageRoutes from '@/routes/minio-storage.routes.js';
import documentPermissionRoutes from '@/routes/document-permission.routes.js';
import auditRoutes from '@/routes/audit.routes.js';
import externalRoutes from '@/routes/external/index.js';
import previewRoutes from '@/routes/preview.routes.js';
import broadcastMessageRoutes from '@/routes/broadcast-message.routes.js';

const app = express();

await initRedis();
const redisClient = getRedisClient();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", config.frontendUrl],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.frontendUrl],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const sessionConfig: session.SessionOptions = {
  store: config.sessionStore.type === 'redis' && redisClient
    ? new RedisStore({ client: redisClient, prefix: 'sess:' })
    : undefined,
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    secure: config.https.enabled,
    httpOnly: true,
    maxAge: config.session.ttlSeconds * 1000,
    sameSite: 'lax',
    domain: config.isProduction ? config.sharedStorageDomain : undefined,
  },
};

app.use(session(sessionConfig));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use('/api', generalLimiter);

const validateContentType = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType) return next();

    if (contentType.includes('application/json') ||
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')) {
      return next();
    }

    return res.status(415).json({
      error: 'Unsupported Media Type',
      message: 'Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded'
    });
  }
  next();
};

app.get('/health', async (_req, res) => {
  const timestamp = new Date().toISOString();

  const dbConnected = await checkConnection();

  const redisStatus = getRedisStatus();

  const healthPayload = {
    status: dbConnected && (redisStatus === 'connected' || redisStatus === 'not_configured') ? 'ok' : 'degraded',
    timestamp,
    services: {
      express: 'running',
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisStatus,
    },
  };

  res.status(healthPayload.status === 'ok' ? 200 : 503).json(healthPayload);
});

app.use('/api', validateContentType);

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/callback', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/system-tools', systemToolsRoutes);
app.use('/api/minio/buckets', minioBucketRoutes);
app.use('/api/minio/raw', minioRawRoutes);
app.use('/api/minio/documents', minioStorageRoutes);
app.use('/api/document-permissions', documentPermissionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/broadcast-messages', broadcastMessageRoutes);

app.use('/api/*', (_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested API endpoint does not exist' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async (): Promise<http.Server | https.Server> => {
  let server: http.Server | https.Server;
  const protocol = config.https.enabled ? 'https' : 'http';

  if (config.https.enabled) {
    const credentials = config.https.getCredentials();
    if (credentials) {
      server = https.createServer(credentials, app);
      log.warn('HTTPS enabled with SSL certificates');
    } else {
      log.warn('HTTPS enabled but certificates not found, falling back to HTTP');
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  server.listen(config.port, async () => {
    server.setTimeout(30 * 60 * 1000);

    log.info(`Backend server started`, {
      url: `${protocol}://${config.devDomain}:${config.port}`,
      environment: config.nodeEnv,
      https: config.https.enabled,
      sessionTTL: `${config.session.ttlSeconds / 86400} days`,
    });

    cronService.startCleanupJob();
    await queueService.initQueues();

    await knowledgeBaseService.initialize();
    await systemToolsService.initialize();

    if (await checkConnection()) {
      log.info('Database connected successfully');

      try {
        const adapter = await getAdapter();
        await runMigrations(adapter);
      } catch (error) {
        log.error('Failed to run migrations', { error });
        process.exit(1);
      }

      await userService.initializeRootUser();
    } else {
      log.warn('Database connection failed');
    }
  });

  return server;
};

process.on('uncaughtException', (err: Error) => {
  log.error('Uncaught Exception - shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  log.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
if (!isTest) {
  startServer().then((server) => {
    const shutdown = async () => {
      log.info('Shutting down server...');
      server.close(() => {
        log.info('HTTP server closed');
      });
      await shutdownRedis();
      await closePool();
      await shutdownLangfuse();
      await queueService.closeQueues();
      await externalTraceService.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }).catch((err) => {
    log.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}

export { app, startServer };
