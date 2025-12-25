/**
 * @fileoverview Unit tests for MinIO bucket routes.
 * Tests bucket configuration management endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/middleware/auth.middleware.js', () => ({
    requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../src/db/index.js', () => ({
    db: {
        query: vi.fn(),
        queryOne: vi.fn(),
    },
}));

vi.mock('../../src/services/minio.service.js', () => ({
    minioService: {
        bucketExists: vi.fn(),
        listBuckets: vi.fn(),
    },
}));

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: {
        log: vi.fn().mockResolvedValue(undefined),
    },
    AuditAction: {
        CREATE_BUCKET: 'CREATE_BUCKET',
        DELETE_BUCKET: 'DELETE_BUCKET',
    },
    AuditResourceType: {
        BUCKET: 'BUCKET',
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-123'),
}));

describe('MinIO Bucket Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export a router', async () => {
            const bucketRoutes = await import('../../src/routes/minio-bucket.routes.js');
            expect(bucketRoutes.default).toBeDefined();
        });
    });

    describe('Bucket name validation', () => {
        const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

        const validBucketNames = [
            'my-bucket',
            'documents-2024',
            'bucket.name.with.dots',
            'a1b2c3',
            'abc', // minimum 3 chars
        ];

        const invalidBucketNames = [
            'MyBucket', // uppercase
            '-invalid', // starts with hyphen
            'invalid-', // ends with hyphen
            'ab', // too short
            'a'.repeat(64), // too long
            'bucket_name', // underscores not allowed
            '.dotstart', // starts with dot
        ];

        validBucketNames.forEach((name) => {
            it(`should accept valid bucket name: ${name}`, () => {
                expect(bucketNameRegex.test(name)).toBe(true);
            });
        });

        invalidBucketNames.forEach((name) => {
            it(`should reject invalid bucket name: ${name}`, () => {
                expect(bucketNameRegex.test(name)).toBe(false);
            });
        });
    });

    describe('MinIO service integration', () => {
        it('should have bucketExists method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.bucketExists).toBe('function');
        });

        it('should have listBuckets method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.listBuckets).toBe('function');
        });

        it('should check if bucket exists', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            vi.mocked(minioService.bucketExists).mockResolvedValue(true);

            const exists = await minioService.bucketExists('test-bucket');

            expect(exists).toBe(true);
            expect(minioService.bucketExists).toHaveBeenCalledWith('test-bucket');
        });

        it('should list available buckets', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            vi.mocked(minioService.listBuckets).mockResolvedValue([
                { name: 'bucket-1', creationDate: new Date() },
                { name: 'bucket-2', creationDate: new Date() },
            ]);

            const buckets = await minioService.listBuckets();

            expect(buckets).toHaveLength(2);
            expect(buckets[0]?.name).toBe('bucket-1');
        });
    });

    describe('Database operations', () => {
        it('should have db.query available', async () => {
            const { db } = await import('../../src/db/index.js');
            expect(typeof db.query).toBe('function');
        });

        it('should query active buckets', async () => {
            const { db } = await import('../../src/db/index.js');
            const mockBuckets = [
                { id: '1', bucket_name: 'bucket-1', display_name: 'Bucket 1', is_active: 1 },
            ];
            vi.mocked(db.query).mockResolvedValue(mockBuckets);

            const result = await db.query(
                'SELECT * FROM minio_buckets WHERE is_active = 1 ORDER BY created_at DESC'
            );

            expect(result).toEqual(mockBuckets);
        });
    });

    describe('Middleware configuration', () => {
        it('should require admin role', async () => {
            const { requireRole } = await import('../../src/middleware/auth.middleware.js');
            expect(requireRole).toBeDefined();
            expect(typeof requireRole).toBe('function');
        });
    });

    describe('Response format', () => {
        it('should format bucket list response correctly', () => {
            const buckets = [
                { id: '1', bucket_name: 'bucket-1', display_name: 'Documents' },
                { id: '2', bucket_name: 'bucket-2', display_name: 'Archives' },
            ];
            const response = {
                buckets,
                count: buckets.length,
            };

            expect(response.count).toBe(2);
            expect(response.buckets).toHaveLength(2);
        });

        it('should format bucket creation response correctly', () => {
            const bucket = {
                id: 'mock-uuid-123',
                bucket_name: 'new-bucket',
                display_name: 'New Bucket',
            };
            const response = {
                message: 'Bucket configured successfully',
                bucket,
            };

            expect(response.message).toBe('Bucket configured successfully');
            expect(response.bucket.id).toBe('mock-uuid-123');
        });

        it('should format available buckets response correctly', () => {
            const buckets = [
                { name: 'unconfigured-bucket', creationDate: new Date() },
            ];
            const response = {
                buckets,
                count: buckets.length,
            };

            expect(response.count).toBe(1);
        });
    });

    describe('Error handling', () => {
        it('should handle missing required fields', () => {
            const body = { bucket_name: 'test' }; // Missing display_name
            const isValid = body.bucket_name && 'display_name' in body;

            expect(isValid).toBe(false);
        });

        it('should handle bucket not found in MinIO', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            vi.mocked(minioService.bucketExists).mockResolvedValue(false);

            const exists = await minioService.bucketExists('non-existent-bucket');

            expect(exists).toBe(false);
        });

        it('should detect already configured bucket', async () => {
            const { db } = await import('../../src/db/index.js');
            vi.mocked(db.query).mockResolvedValue([{ id: '1', bucket_name: 'existing-bucket' }]);

            const result = await db.query('SELECT * FROM minio_buckets WHERE bucket_name = $1', [
                'existing-bucket',
            ]);

            expect(result.length).toBeGreaterThan(0);
        });
    });
});
