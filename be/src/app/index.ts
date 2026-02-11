
/**
 * Application entrypoint: configures middleware, routes, background jobs, and graceful shutdown.
 * Keep all environment access through `config` to preserve centralized validation.
 */
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis'; // Fixed named import
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as http from 'http';
import * as https from 'https';

import { config } from '@/shared/config/index.js';
import { log } from '@/shared/services/logger.service.js';
import { initRedis, getRedisClient, shutdownRedis } from '@/shared/services/redis.service.js';
import { db, getAdapter, checkConnection, closePool } from '@/shared/db/index.js';
// import { runMigrations } from '@/shared/db/migrations/runner.js'; // Deprecated/Removed
import knex from 'knex';
import dbConfig from '@/shared/db/knexfile.js';
import { cronService } from '@/shared/services/cron.service.js';
import { knowledgeBaseService } from '@/modules/knowledge-base/knowledge-base.service.js';
import { systemToolsService } from '@/modules/system-tools/system-tools.service.js';
import { userService } from '@/modules/users/user.service.js';
import { shutdownLangfuse } from '@/shared/services/langfuse.service.js';
import { externalTraceService } from '@/modules/external/trace.service.js';
import { socketService } from '@/shared/services/socket.service.js';

import { setupApiRoutes } from '@/app/routes.js';

const app = express();

// Initialize Redis before any middleware that relies on it (sessions, rate limiting storage)
await initRedis();
const redisClient = getRedisClient();

app.set('trust proxy', 1);

// Harden basic security headers; CSP is relaxed only where absolutely required for the iframe use case
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

// CORS is restricted to the configured frontend to keep cookies/sessions scoped
app.use(cors({
  origin: config.cors.origins,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session cookies are the primary auth mechanism (Azure AD-backed); Redis store is used when configured
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

// Setup all API routes and middleware
setupApiRoutes(app);

// Bootstraps HTTP/HTTPS server and initializes background services that require the listener
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

  // Initialize Socket.IO with the server
  if (config.websocket.enabled) {
    socketService.initialize(server);
  }

  server.listen(config.port, async () => {
    server.setTimeout(30 * 60 * 1000);

    log.info(`Backend server started`, {
      url: `${protocol}://${config.devDomain}:${config.port}`,
      environment: config.nodeEnv,
      https: config.https.enabled,
      websocket: config.websocket.enabled,
      sessionTTL: `${config.session.ttlSeconds / 86400} days`,
    });

    // Schedule recurring maintenance (temp file cleanup, etc.)
    cronService.startCleanupJob();

    await knowledgeBaseService.initialize();
    await systemToolsService.initialize();

    if (await checkConnection()) {
      log.info('Database connected successfully');

      // Keep schema aligned on boot to avoid drift across environments
      try {
        log.info('Running Knex migrations...');
        const k = knex(dbConfig);
        await k.migrate.latest();
        await k.destroy();
        log.info('Knex migrations completed successfully');
      } catch (error) {
        log.error('Failed to run migrations', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        process.exit(1);
      }

      // Ensure a bootstrap admin exists even on fresh databases
      await userService.initializeRootUser();
    } else {
      log.warn('Database connection failed');
    }
  });

  return server;
};

// Force crash on unexpected sync exceptions to avoid undefined state
process.on('uncaughtException', (err: Error) => {
  log.error('Uncaught Exception - shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Log unhandled promise rejections; keep process alive to allow graceful shutdown hooks
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
      await externalTraceService.shutdown();
      await socketService.shutdown();
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
