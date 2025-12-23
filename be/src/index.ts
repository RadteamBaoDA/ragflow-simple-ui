/**
 * @fileoverview Main application entry point for the Knowledge Base backend server.
 * 
 * This file initializes and configures the Express.js server with:
 * - CORS configuration for frontend communication
 * - Session management (Redis or in-memory)
 * - Security middleware (Helmet, compression)
 * - API routes for authentication, RAGFlow, admin, users, and MinIO storage
 * - Database connection and migration handling
 * - Graceful shutdown handling
 * 
 * @module index
 * @requires express
 * @requires express-session
 * @requires connect-redis
 */

import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { config } from './config/index.js';
import { log } from './services/logger.service.js';
import { initRedis, getRedisClient, shutdownRedis, getRedisStatus } from './services/redis.service.js';

// ============================================================================
// SSL/TLS CONFIGURATION
// ============================================================================

if (config.ignoreSelfSignedCerts) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  log.warn('SECURITY WARNING: Self-signed SSL certificates are being ignored. This makes the application insecure and should only be used in development.');
}
import { shutdownLangfuse } from './services/langfuse.service.js';
import { checkConnection, closePool, getAdapter } from './db/index.js';
import { userService } from './services/user.service.js';
import authRoutes from './routes/auth.routes.js';
import { knowledgeBaseRoutes } from './routes/knowledge-base.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import systemToolsRoutes from './routes/system-tools.routes.js';
import teamRoutes from './routes/team.routes.js';
import minioBucketRoutes from './routes/minio-bucket.routes.js';
import minioRawRoutes from './routes/minio-raw.routes.js';
import minioStorageRoutes from './routes/minio-storage.routes.js';
import documentPermissionRoutes from './routes/document-permission.routes.js';
import auditRoutes from './routes/audit.routes.js';
import externalRoutes from './routes/external/index.js';
import previewRoutes from './routes/preview.routes.js';
import broadcastMessageRoutes from './routes/broadcast-message.routes.js';
import { externalTraceService } from './services/external-trace.service.js';
import { runMigrations } from './db/migrations/runner.js';
import { cronService } from './services/cron.service.js';
import { knowledgeBaseService } from './services/knowledge-base.service.js';
import { systemToolsService } from './services/system-tools.service.js';

/**
 * ESM-compatible __filename and __dirname resolution.
 * Required because ES modules don't have these globals like CommonJS.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Express application instance */
const app = express();

// ============================================================================
// SESSION STORE CONFIGURATION
// ============================================================================

/**
 * Session store instance - either RedisStore for production or undefined for MemoryStore.
 * RedisStore provides persistent session storage across server restarts and load-balanced instances.
 * MemoryStore is used for development but sessions are lost on restart.
 */
let sessionStore: RedisStore | undefined;

// Initialize Redis client if configured for Redis session storage
const redisClient = await initRedis();

if (redisClient) {
  // Initialize store immediately with the client
  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'kb:sess:',
    ttl: config.session.ttlSeconds,
  });
  log.info('Session store: Redis initialized');
} else if (config.sessionStore.type === 'redis') {
  log.warn('Redis configured but failed to initialize. Session storage might be broken.');
} else {
  log.info('Session store: MemoryStore (in-memory sessions)');
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

app.set('trust proxy', 1); // Trust first proxy (needed for secure cookies behind proxies/load balancers)

/**
 * CORS (Cross-Origin Resource Sharing) configuration.
 * Must be applied before other middleware to properly handle preflight requests.
 * 
 * - origin: Allows requests from the configured frontend URL only
 * - credentials: Enables cookies/session sharing across origins
 * - methods: Allowed HTTP methods for cross-origin requests
 * - allowedHeaders: Headers that can be sent in cross-origin requests
 */
const rootDomain = config.sharedStorageDomain.startsWith('.')
  ? config.sharedStorageDomain.substring(1)
  : config.sharedStorageDomain;

const globalCors = cors({
  origin: (requestOrigin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!requestOrigin) return callback(null, true);

    // Check if exact match with frontendUrl
    if (requestOrigin === config.frontendUrl) return callback(null, true);

    // Check if same root domain
    try {
      const originUrl = new URL(requestOrigin);
      if (originUrl.hostname === rootDomain || originUrl.hostname.endsWith('.' + rootDomain)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, ignore
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
});

/**
 * Apply global CORS to all routes EXCEPT /api/external
 * External trace routes handle their own CORS to allow cross-origin collection.
 */
app.use((req, res, next) => {
  if (req.path.startsWith('/api/external')) {
    return next();
  }
  globalCors(req, res, next);
});

/**
 * Response compression middleware.
 * Compresses HTTP responses using gzip/deflate to reduce bandwidth usage.
 */
app.use(compression());

/**
 * Static file serving for public assets.
 * Files in the 'public' directory are served at the '/static' URL path.
 * Used for icons, images, and other static resources.
 */
app.use('/static', express.static(path.join(__dirname, '../public')));

/**
 * Session middleware configuration.
 * Manages user sessions with secure cookie settings.
 * 
 * Configuration details:
 * - store: Redis store for production, MemoryStore for development
 * - secret: Used to sign session ID cookie (must be secure in production)
 * - resave: Don't save session if not modified
 * - saveUninitialized: Don't create session until something is stored
 * - cookie.secure: Only send cookie over HTTPS in production
 * - cookie.httpOnly: Prevent JavaScript access to cookie (XSS protection)
 * - cookie.maxAge: Session expiration time (default: 7 days)
 * - cookie.domain: Enables cross-subdomain session sharing
 * - cookie.sameSite: CSRF protection - 'lax' allows top-level navigation
 */
app.use(session({
  store: sessionStore, // undefined = MemoryStore
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.https.enabled || config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: config.session.ttlSeconds * 1000, // Convert to milliseconds
    // Set domain for cross-subdomain session sharing
    domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    sameSite: 'lax',
  },
}));

/**
 * Helmet security middleware.
 * Sets various HTTP headers to help protect against common web vulnerabilities.
 * 
 * Content Security Policy (CSP) directives:
 * - Configured to allow RAGFlow iframe embedding
 * - Allows inline scripts/styles for compatibility with various components
 * - Permits cross-origin resources for external APIs and assets
 * 
 * Cross-Origin settings:
 * - crossOriginEmbedderPolicy: Disabled to allow embedding external resources
 * - crossOriginResourcePolicy: Set to 'cross-origin' for shared resources
 * 
 * Additional Security Headers:
 * - X-Content-Type-Options: nosniff (prevents MIME sniffing)
 * - X-Frame-Options: Configured for iframe embedding
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - X-XSS-Protection: 1; mode=block (legacy XSS filter)
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://ui-avatars.com", "https://graph.microsoft.com"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://login.microsoftonline.com", "https://graph.microsoft.com"],
      frameSrc: ["'self'", "*"], // RAGFlow iframes
      frameAncestors: ["'self'", config.frontendUrl],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
}));

/**
 * Request body parsing middleware.
 * - express.json(): Parses JSON request bodies with size limit
 * - express.urlencoded(): Parses URL-encoded form data (with nested object support)
 * 
 * Size limits prevent DoS attacks via large payloads.
 */
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

/**
 * HTTP Parameter Pollution (HPP) protection.
 * Per OWASP Node.js Security Cheat Sheet:
 * - Prevents attackers from polluting req.query/req.body with arrays
 * - Selects the last value when multiple values are provided
 */
app.use(hpp());

/**
 * Security headers for API responses.
 * Per OWASP REST Security Cheat Sheet:
 * - Cache-Control: no-store - Prevents caching of sensitive API responses
 * - X-Content-Type-Options: nosniff - Prevents MIME sniffing (also set by Helmet)
 */
app.use((_req, res, next) => {
  // Prevent caching of API responses containing sensitive data
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

/**
 * Rate limiting middleware.
 * Per OWASP REST Security Cheat Sheet:
 * - Return 429 Too Many Requests when rate limit is exceeded
 * - Protects against DoS and brute-force attacks
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too Many Requests', message: 'Please try again later' },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Stricter rate limit for authentication endpoints.
 * Prevents brute-force attacks on login endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Too many authentication attempts, please try again later' },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

/**
 * Content-Type validation middleware for API routes.
 * Per OWASP REST Security Cheat Sheet:
 * - Reject requests with unexpected Content-Type headers
 * - Only allow application/json for POST/PUT/PATCH requests
 */
const validateContentType = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Only validate for requests that should have a body
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];

  if (methodsWithBody.includes(req.method)) {
    const contentType = req.headers['content-type'];

    // Allow requests with no body (Content-Length: 0)
    const contentLength = req.headers['content-length'];
    if (contentLength === '0' || contentLength === undefined) {
      return next();
    }

    // Check for valid JSON content type (also allow multipart for file uploads)
    if (contentType &&
      (contentType.includes('application/json') ||
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded'))) {
      return next();
    }

    log.warn('Invalid Content-Type header', {
      method: req.method,
      path: req.path,
      contentType,
    });

    return res.status(415).json({
      error: 'Unsupported Media Type',
      message: 'Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded'
    });
  }

  next();
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * Health check endpoint for load balancers and monitoring systems.
 * Returns a simple JSON response with server status and timestamp.
 * Used by Docker, Kubernetes, and other orchestration tools.
 */
app.get('/health', async (_req, res) => {
  const timestamp = new Date().toISOString();
  const databaseConnected = await checkConnection();

  const redisStatus = getRedisStatus();

  const healthPayload = {
    status: databaseConnected && (redisStatus === 'connected' || redisStatus === 'not_configured') ? 'ok' : 'degraded',
    timestamp,
    services: {
      express: 'running',
      database: databaseConnected ? 'connected' : 'disconnected',
      redis: redisStatus,
    },
  };

  log.info('Health status', healthPayload);

  res.status(healthPayload.status === 'ok' ? 200 : 503).json(healthPayload);
});

/**
 * API Route Registration.
 * All routes are prefixed with '/api/' for clear API namespace separation.
 * 
 * Route handlers:
 * - /api/auth: Authentication (Azure AD OAuth, session management, logout)
 * - /api/ragflow: RAGFlow iframe configuration for AI Chat/Search
 * - /api/admin: Administrative operations (requires admin API key)
 * - /api/users: User management (RBAC, role updates)
 * - /api/system-tools: System monitoring tools configuration
 * - /api/minio/buckets: MinIO bucket CRUD operations
 * - /api/minio/storage: File upload/download/delete operations
 */
app.use('/api', validateContentType);

// Apply stricter rate limiting to auth endpoints (brute-force protection)
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

/**
 * 404 handler for undefined API routes.
 * Per OWASP REST Security: Return proper 404 for non-existent resources.
 */
app.use('/api/*', (_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested API endpoint does not exist' });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handling middleware.
 * Catches unhandled errors from route handlers and middleware.
 * 
 * - Logs error details for debugging (message and stack trace)
 * - Returns a generic 500 error to clients (hides implementation details)
 * - Must be defined after all other middleware and routes
 * - Sanitizes error output to prevent information leakage
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  // Never expose internal error details to clients
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Initializes and starts the HTTP/HTTPS server.
 * 
 * Startup sequence:
 * 1. Connect to Redis for session storage (if configured)
 * 2. Create HTTP or HTTPS server based on configuration
 * 3. Start listening on configured port
 * 4. Verify database connection
 * 5. Run pending database migrations
 * 6. Initialize root user if database is empty
 * 
 * @returns Promise resolving to the HTTP/HTTPS server instance
 */
const startServer = async (): Promise<http.Server | https.Server> => {
  // Redis is already initialized at module level awaiting promise but we called it in global scope
  // which is bad practice on import. But since we need session middleware at top level...
  // Actually, we called it before app.use(session(...)).
  // So here we don't need to do anything for Redis.


  let server: http.Server | https.Server;
  const protocol = config.https.enabled ? 'https' : 'http';

  // Create HTTPS or HTTP server based on configuration
  // HTTPS requires SSL certificates (key.pem, cert.pem) in the certs directory
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

  // Start listening and perform post-startup initialization
  server.listen(config.port, async () => {
    // Increase server timeout to 30 minutes to handle large file uploads
    server.setTimeout(30 * 60 * 1000);

    log.info(`Backend server started`, {
      url: `${protocol}://${config.devDomain}:${config.port}`,
      environment: config.nodeEnv,
      https: config.https.enabled,
      sessionTTL: `${config.session.ttlSeconds / 86400} days`,
    });

    // Start cron jobs
    cronService.startCleanupJob();

    // Initialize async services
    await knowledgeBaseService.initialize();
    await systemToolsService.initialize();

    // Verify database connectivity
    const dbConnected = await checkConnection();
    if (dbConnected) {
      log.info('Database connected successfully');

      // Execute pending database migrations
      try {
        const db = await getAdapter();
        await runMigrations(db);
      } catch (error) {
        log.error('Failed to run migrations', { error });
        process.exit(1);
      }

      // Create default admin user if no users exist
      await userService.initializeRootUser();
    } else {
      log.warn('Database connection failed - run npm run db:migrate first');
    }
  });

  return server;
};

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

/**
 * Conditional server startup.
 * Only starts the server when:
 * - Running as the main entry point (not imported as a module)
 * - Not in test mode (NODE_ENV !== 'test' and no VITEST env)
 * 
 * This allows the app to be imported for testing without starting the server.
 */
// ============================================================================
// ERROR HANDLERS FOR UNCAUGHT EXCEPTIONS AND REJECTIONS
// ============================================================================

/**
 * Per OWASP Node.js Security Cheat Sheet:
 * Handle uncaught exceptions to prevent information leakage and ensure graceful shutdown.
 * Never resume application after uncaught exception as it may be in unknown state.
 */
process.on('uncaughtException', (err: Error) => {
  log.error('Uncaught Exception - shutting down', {
    error: err.message,
    stack: err.stack,
  });
  // Exit with failure code - let process manager restart
  process.exit(1);
});

/**
 * Per OWASP Node.js Security Cheat Sheet:
 * Handle unhandled promise rejections to prevent crashes and log errors properly.
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  log.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // In production, we might want to exit here as well
  // For now, just log - the error handling middleware will catch sync errors
});

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
if (!isTest) {
  startServer().then((server) => {
    /**
     * Graceful shutdown handler.
     * Properly closes all connections and resources before exiting:
     * 1. Stop accepting new HTTP connections
     * 2. Close Redis client connection
     * 3. Close database connection pool
     * 4. Flush Langfuse traces and shutdown client
     * 5. Exit process with success code
     * 
     * Triggered by SIGTERM (Docker/K8s stop) or SIGINT (Ctrl+C)
     */
    const shutdown = async () => {
      log.info('Shutting down server...');

      // Stop accepting new connections
      server.close(() => {
        log.info('HTTP server closed');
      });

      // Disconnect Redis session store
      await shutdownRedis();

      // Close database connections
      await closePool();

      // Flush and close Langfuse client
      await shutdownLangfuse();

      // Shutdown external trace service Redis client
      await externalTraceService.shutdown();

      process.exit(0);
    };

    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', shutdown);  // Docker/Kubernetes stop signal
    process.on('SIGINT', shutdown);   // Ctrl+C interrupt signal
  }).catch((err) => {
    log.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}

export { app, startServer };
