/**
 * @fileoverview Unit tests for centralized configuration module.
 * Tests environment variable loading, defaults, and production validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';

// Mock fs for SSL certificate checks
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

// Mock dotenv
vi.mock('dotenv', () => ({
    default: {
        config: vi.fn(),
    },
}));

// Mock logger to avoid circular dependency
vi.mock('../../src/shared/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('Config Module', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env = { ...originalEnv };
        // Default: no SSL certs
        vi.mocked(existsSync).mockReturnValue(false);
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    describe('Basic Configuration', () => {
        it('should export config object', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config).toBeDefined();
            expect(typeof config.port).toBe('number');
            expect(typeof config.nodeEnv).toBe('string');
        });

        it('should use default port 3001', async () => {
            delete process.env.PORT;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.port).toBe(3001);
        });

        it('should use custom port from environment', async () => {
            process.env.PORT = '8080';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.port).toBe(8080);
        });

        it('should detect development environment', async () => {
            delete process.env.NODE_ENV;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.nodeEnv).toBe('development');
            expect(config.isProduction).toBe(false);
        });

        it('should detect production environment', async () => {
            process.env.NODE_ENV = 'production';
            // Provide required env vars for production
            process.env.SESSION_SECRET = 'test-production-secret';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.nodeEnv).toBe('production');
            expect(config.isProduction).toBe(true);
        });
    });

    describe('HTTPS Configuration', () => {
        it('should be disabled when no SSL certs exist', async () => {
            process.env.HTTPS_ENABLED = 'true';
            vi.mocked(existsSync).mockReturnValue(false);

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.https.enabled).toBe(false);
        });

        it('should be enabled when SSL certs exist and HTTPS_ENABLED is true', async () => {
            process.env.HTTPS_ENABLED = 'true';
            vi.mocked(existsSync).mockReturnValue(true);

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.https.enabled).toBe(true);
        });

        it('should return null credentials when no certs exist', async () => {
            vi.mocked(existsSync).mockReturnValue(false);

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.https.getCredentials()).toBeNull();
        });

        it('should read SSL credentials when certs exist', async () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync)
                .mockReturnValueOnce(Buffer.from('key-content'))
                .mockReturnValueOnce(Buffer.from('cert-content'));

            const { config } = await import('../../src/shared/config/index.js');
            const creds = config.https.getCredentials();

            expect(creds).not.toBeNull();
            expect(creds?.key).toEqual(Buffer.from('key-content'));
            expect(creds?.cert).toEqual(Buffer.from('cert-content'));
        });
    });

    describe('Database Configuration', () => {
        it('should use default database connection values', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.database.host).toBe('localhost');
            expect(config.database.port).toBe(5432);
            expect(config.database.name).toBe('knowledge_base');
            expect(config.database.user).toBe('postgres');
        });

        it('should use custom database connection values', async () => {
            process.env.DB_HOST = 'db.example.com';
            process.env.DB_PORT = '5433';
            process.env.DB_NAME = 'custom_db';
            process.env.DB_USER = 'custom_user';
            process.env.DB_PASSWORD = 'secret123';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.database.host).toBe('db.example.com');
            expect(config.database.port).toBe(5433);
            expect(config.database.name).toBe('custom_db');
            expect(config.database.user).toBe('custom_user');
            expect(config.database.password).toBe('secret123');
        });
    });

    describe('Langfuse Configuration', () => {
        it('should use default Langfuse values', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.langfuse.secretKey).toBe('');
            expect(config.langfuse.publicKey).toBe('');
            expect(config.langfuse.baseUrl).toBe('https://cloud.langfuse.com');
        });

        it('should use custom Langfuse values', async () => {
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_BASE_URL = 'https://custom.langfuse.com';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.langfuse.secretKey).toBe('sk-test');
            expect(config.langfuse.publicKey).toBe('pk-test');
            expect(config.langfuse.baseUrl).toBe('https://custom.langfuse.com');
        });
    });

    describe('Azure AD Configuration', () => {
        it('should use empty defaults in development', async () => {
            delete process.env.NODE_ENV;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.azureAd.clientId).toBe('');
            expect(config.azureAd.clientSecret).toBe('');
            expect(config.azureAd.tenantId).toBe('');
        });

        it('should use custom Azure AD values', async () => {
            process.env.AZURE_AD_CLIENT_ID = 'client-id-123';
            process.env.AZURE_AD_CLIENT_SECRET = 'client-secret';
            process.env.AZURE_AD_TENANT_ID = 'tenant-id-456';
            process.env.AZURE_AD_REDIRECT_URI = 'https://app.example.com/callback';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.azureAd.clientId).toBe('client-id-123');
            expect(config.azureAd.clientSecret).toBe('client-secret');
            expect(config.azureAd.tenantId).toBe('tenant-id-456');
            expect(config.azureAd.redirectUri).toBe('https://app.example.com/callback');
        });
    });

    describe('Redis Configuration', () => {
        it('should use default Redis values', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.redis.host).toBe('localhost');
            expect(config.redis.port).toBe(6379);
            expect(config.redis.password).toBeUndefined();
            expect(config.redis.db).toBe(0);
        });

        it('should generate Redis URL without password', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.redis.url).toBe('redis://localhost:6379/0');
        });

        it('should generate Redis URL with password', async () => {
            process.env.REDIS_PASSWORD = 'secret';
            process.env.REDIS_HOST = 'redis.example.com';
            process.env.REDIS_PORT = '6380';
            process.env.REDIS_DB = '1';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.redis.url).toBe('redis://:secret@redis.example.com:6380/1');
        });
    });

    describe('Session Configuration', () => {
        it('should use default session secret in development', async () => {
            delete process.env.NODE_ENV;
            delete process.env.SESSION_SECRET;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.session.secret).toBe('change-me-in-production');
        });

        it('should calculate TTL in seconds from days', async () => {
            process.env.SESSION_TTL_DAYS = '1';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.session.ttlSeconds).toBe(86400); // 1 day in seconds
        });

        it('should use default 7 days TTL', async () => {
            delete process.env.SESSION_TTL_DAYS;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.session.ttlSeconds).toBe(7 * 24 * 60 * 60);
        });
    });

    describe('Frontend Configuration', () => {
        it('should use default frontend URL', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.frontendUrl).toBe('http://localhost:5173');
        });

        it('should use custom frontend URL', async () => {
            process.env.FRONTEND_URL = 'https://app.example.com';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.frontendUrl).toBe('https://app.example.com');
        });
    });

    describe('Feature Flags', () => {
        it('should have root login disabled by default', async () => {
            delete process.env.ENABLE_ROOT_LOGIN;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.enableRootLogin).toBe(false);
        });

        it('should enable root login when flag is set', async () => {
            process.env.ENABLE_ROOT_LOGIN = 'true';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.enableRootLogin).toBe(true);
        });
    });

    describe('Session Store Configuration', () => {
        it('should use memory store in development by default', async () => {
            delete process.env.NODE_ENV;
            delete process.env.SESSION_STORE;

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.sessionStore.type).toBe('memory');
        });

        it('should use redis store in production by default', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.SESSION_STORE;
            process.env.SESSION_SECRET = 'test-secret';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.sessionStore.type).toBe('redis');
        });
    });

    describe('CORS Configuration', () => {
        it('uses frontend URL when CORS_ORIGINS is not set', async () => {
            delete process.env.CORS_ORIGINS;
            process.env.FRONTEND_URL = 'http://example.com';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.cors.origins).toEqual(['http://example.com']);
        });

        it('supports wildcard origins', async () => {
            process.env.CORS_ORIGINS = '*';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.cors.origins).toBe('*');
        });

        it('parses comma-separated origins', async () => {
            process.env.CORS_ORIGINS = 'http://one.com, https://two.com';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.cors.origins).toEqual(['http://one.com', 'https://two.com']);
        });
    });

    describe('External Trace Configuration', () => {
        it('uses defaults when unset', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.externalTrace.enabled).toBe(false);
            expect(config.externalTrace.apiKey).toBe('');
            expect(config.externalTrace.cacheTtlSeconds).toBe(300);
            expect(config.externalTrace.lockTimeoutMs).toBe(5000);
        });

        it('reads values from environment', async () => {
            process.env.EXTERNAL_TRACE_ENABLED = 'true';
            process.env.EXTERNAL_TRACE_API_KEY = 'trace-key';
            process.env.EXTERNAL_TRACE_CACHE_TTL = '120';
            process.env.EXTERNAL_TRACE_LOCK_TIMEOUT = '2000';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.externalTrace.enabled).toBe(true);
            expect(config.externalTrace.apiKey).toBe('trace-key');
            expect(config.externalTrace.cacheTtlSeconds).toBe(120);
            expect(config.externalTrace.lockTimeoutMs).toBe(2000);
        });
    });

    describe('WebSocket Configuration', () => {
        it('uses defaults when unset', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.websocket.enabled).toBe(true);
            expect(config.websocket.apiKey).toBe('');
            expect(config.websocket.corsOrigin).toBe('http://localhost:5173');
            expect(config.websocket.pingTimeout).toBe(60000);
            expect(config.websocket.pingInterval).toBe(25000);
        });

        it('reads values from environment', async () => {
            process.env.WEBSOCKET_ENABLED = 'false';
            process.env.WEBSOCKET_API_KEY = 'ws-key';
            process.env.WEBSOCKET_CORS_ORIGIN = 'http://ws.example.com';
            process.env.WEBSOCKET_PING_TIMEOUT = '12345';
            process.env.WEBSOCKET_PING_INTERVAL = '54321';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.websocket.enabled).toBe(false);
            expect(config.websocket.apiKey).toBe('ws-key');
            expect(config.websocket.corsOrigin).toBe('http://ws.example.com');
            expect(config.websocket.pingTimeout).toBe(12345);
            expect(config.websocket.pingInterval).toBe(54321);
        });
    });

    describe('Additional flags', () => {
        it('respects ignoreSelfSignedCerts flag', async () => {
            process.env.IGNORE_SELF_SIGNED_CERTS = 'true';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.ignoreSelfSignedCerts).toBe(true);
        });

        it('exposes root user defaults', async () => {
            const { config } = await import('../../src/shared/config/index.js');

            expect(config.rootUser).toBe('admin@localhost');
            expect(config.rootPassword).toBe('admin');
        });

        it('honors ragflow and system tool config paths', async () => {
            process.env.RAGFLOW_CONFIG_PATH = '/tmp/ragflow.json';
            process.env.SYSTEM_TOOLS_CONFIG_PATH = '/tmp/system-tools.json';

            const { config } = await import('../../src/shared/config/index.js');

            expect(config.ragflowConfigPath).toBe('/tmp/ragflow.json');
            expect(config.systemToolsConfigPath).toBe('/tmp/system-tools.json');
        });
    });
});
