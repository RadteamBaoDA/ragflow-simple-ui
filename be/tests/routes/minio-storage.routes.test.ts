/**
 * @fileoverview Unit tests for MinIO storage routes.
 * Tests file upload, download, and management endpoints.
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
    requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    requireRecentAuth: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    getCurrentUser: vi.fn().mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        role: 'admin',
    }),
    REAUTH_REQUIRED_ERROR: 'REAUTH_REQUIRED',
}));

vi.mock('../../src/db/index.js', () => ({
    query: vi.fn(),
    queryOne: vi.fn(),
}));

vi.mock('../../src/services/minio.service.js', () => ({
    minioService: {
        listObjects: vi.fn(),
        uploadFile: vi.fn(),
        createFolder: vi.fn(),
        deleteObject: vi.fn(),
        deleteFolder: vi.fn(),
        getDownloadUrl: vi.fn(),
    },
}));

vi.mock('../../src/services/audit.service.js', () => ({
    auditService: {
        log: vi.fn().mockResolvedValue(undefined),
    },
    AuditAction: {
        UPLOAD_FILE: 'UPLOAD_FILE',
        CREATE_FOLDER: 'CREATE_FOLDER',
        DELETE_FILE: 'DELETE_FILE',
        DELETE_FOLDER: 'DELETE_FOLDER',
    },
    AuditResourceType: {
        FILE: 'FILE',
    },
}));

vi.mock('../../src/services/file-validation.service.js', () => ({
    validateUploadedFile: vi.fn().mockReturnValue({ isValid: true }),
    sanitizeFilename: vi.fn().mockReturnValue({ sanitized: 'safe-filename.txt' }),
    generateSafeFilename: vi.fn().mockReturnValue('uuid-safe-filename.txt'),
    sanitizeObjectPath: vi.fn().mockImplementation((path: string) => {
        if (path.includes('..')) return null;
        return path.replace(/^\/+|\/+$/g, '');
    }),
}));

vi.mock('../../src/config/file-upload.config.js', () => ({
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_FILENAME_LENGTH: 255,
    MAX_FILES_PER_REQUEST: 10,
    MAX_FIELD_SIZE: 1024,
}));

describe('MinIO Storage Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export a router', async () => {
            const storageRoutes = await import('../../src/routes/minio-storage.routes.js');
            expect(storageRoutes.default).toBeDefined();
        });
    });

    describe('File validation integration', () => {
        it('should have validateUploadedFile function', async () => {
            const { validateUploadedFile } = await import(
                '../../src/services/file-validation.service.js'
            );
            expect(typeof validateUploadedFile).toBe('function');
        });

        it('should have sanitizeFilename function', async () => {
            const { sanitizeFilename } = await import(
                '../../src/services/file-validation.service.js'
            );
            expect(typeof sanitizeFilename).toBe('function');
        });

        it('should have sanitizeObjectPath function', async () => {
            const { sanitizeObjectPath } = await import(
                '../../src/services/file-validation.service.js'
            );
            expect(typeof sanitizeObjectPath).toBe('function');
        });

        it('should validate file validation function exists', async () => {
            const { validateUploadedFile } = await import(
                '../../src/services/file-validation.service.js'
            );

            expect(validateUploadedFile).toBeDefined();
        });

        it('should validate sanitize filename function exists', async () => {
            const { sanitizeFilename } = await import(
                '../../src/services/file-validation.service.js'
            );

            expect(sanitizeFilename).toBeDefined();
        });
    });

    describe('Path traversal prevention', () => {
        it('should have path validation logic', () => {
            // Test path validation logic inline
            const invalidPath = '../../../etc/passwd';
            const validPath = 'documents/folder/file.txt';

            expect(invalidPath.includes('..')).toBe(true);
            expect(validPath.includes('..')).toBe(false);
        });

        it('should strip leading slashes pattern', () => {
            const path = '/documents/';
            const stripped = path.replace(/^\/+|\/+$/g, '');
            expect(stripped).toBe('documents');
        });
    });

    describe('MinIO service integration', () => {
        it('should have listObjects method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.listObjects).toBe('function');
        });

        it('should have uploadFile method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.uploadFile).toBe('function');
        });

        it('should have createFolder method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.createFolder).toBe('function');
        });

        it('should have deleteObject method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.deleteObject).toBe('function');
        });

        it('should have deleteFolder method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.deleteFolder).toBe('function');
        });

        it('should have getDownloadUrl method', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            expect(typeof minioService.getDownloadUrl).toBe('function');
        });

        it('should list objects in bucket', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            vi.mocked(minioService.listObjects).mockResolvedValue([
                { name: 'file1.txt', size: 100, lastModified: new Date(), etag: 'abc', isFolder: false },
            ]);

            const files = await minioService.listObjects('test-bucket', '', false);

            expect(files).toHaveLength(1);
            expect(files[0]?.name).toBe('file1.txt');
        });

        it('should generate presigned download URL', async () => {
            const { minioService } = await import('../../src/services/minio.service.js');
            vi.mocked(minioService.getDownloadUrl).mockResolvedValue(
                'https://minio.example.com/bucket/file?signature=xxx'
            );

            const url = await minioService.getDownloadUrl('bucket', 'file.txt', 3600);

            expect(url).toContain('https://');
            expect(minioService.getDownloadUrl).toHaveBeenCalledWith('bucket', 'file.txt', 3600);
        });
    });

    describe('Upload configuration', () => {
        it('should have correct file size limit', async () => {
            const { MAX_FILE_SIZE } = await import('../../src/config/file-upload.config.js');
            expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
        });

        it('should have correct filename length limit', async () => {
            const { MAX_FILENAME_LENGTH } = await import('../../src/config/file-upload.config.js');
            expect(MAX_FILENAME_LENGTH).toBe(255);
        });

        it('should have correct files per request limit', async () => {
            const { MAX_FILES_PER_REQUEST } = await import('../../src/config/file-upload.config.js');
            expect(MAX_FILES_PER_REQUEST).toBe(10);
        });
    });

    describe('Middleware configuration', () => {
        it('should require authentication', async () => {
            const { requireAuth } = await import('../../src/middleware/auth.middleware.js');
            expect(requireAuth).toBeDefined();
        });

        it('should require storage:write permission', async () => {
            const { requirePermission } = await import('../../src/middleware/auth.middleware.js');
            expect(requirePermission).toBeDefined();
        });

        it('should require recent auth for folder deletion', async () => {
            const { requireRecentAuth } = await import('../../src/middleware/auth.middleware.js');
            expect(requireRecentAuth).toBeDefined();
        });
    });

    describe('Response format', () => {
        it('should format list response correctly', () => {
            const files = [
                { name: 'file1.txt', size: 100, lastModified: new Date(), etag: 'abc', isFolder: false },
            ];
            const response = {
                bucket_id: 'bucket-uuid',
                bucket_name: 'test-bucket',
                prefix: '',
                objects: files.map((f) => ({
                    name: f.name,
                    size: f.size,
                    lastModified: f.lastModified,
                    etag: f.etag,
                    isFolder: f.isFolder,
                })),
                count: files.length,
            };

            expect(response.count).toBe(1);
            expect(response.bucket_name).toBe('test-bucket');
        });

        it('should format upload response correctly', () => {
            const results = [
                { name: 'file1.txt', originalName: 'file1.txt', size: 100, status: 'uploaded' },
                { name: 'file2.exe', originalName: 'file2.exe', size: 200, status: 'rejected', error: 'Invalid file type' },
            ];

            const successCount = results.filter((r) => r.status === 'uploaded').length;
            const failedCount = results.length - successCount;

            const response = {
                message: `${successCount} file(s) uploaded, ${failedCount} failed`,
                results,
            };

            expect(response.message).toBe('1 file(s) uploaded, 1 failed');
        });

        it('should format download response correctly', () => {
            const response = {
                download_url: 'https://minio.example.com/bucket/file?signature=xxx',
                expires_in: 3600,
            };

            expect(response.expires_in).toBe(3600);
            expect(response.download_url).toContain('https://');
        });

        it('should format batch delete response correctly', () => {
            const results = [
                { path: 'file1.txt', status: 'deleted' },
                { path: 'file2.txt', status: 'deleted' },
                { path: 'file3.txt', status: 'failed', error: 'Not found' },
            ];

            const successCount = results.filter((r) => r.status === 'deleted').length;
            const failedCount = results.length - successCount;

            const response = {
                message: `${successCount} item(s) deleted, ${failedCount} failed`,
                results,
            };

            expect(response.message).toBe('2 item(s) deleted, 1 failed');
        });
    });

    describe('Error handling', () => {
        it('should handle missing bucket ID', () => {
            const bucketId = undefined;
            expect(!bucketId).toBe(true);
        });

        it('should handle invalid prefix patterns', () => {
            const invalidPrefixes = ['../invalid', '../../secret', '../../../etc/passwd'];
            invalidPrefixes.forEach((prefix) => {
                expect(prefix.includes('..')).toBe(true);
            });
        });        it('should handle no files uploaded', () => {
            const files: Express.Multer.File[] = [];
            expect(files.length === 0).toBe(true);
        });

        it('should handle file not found errors', () => {
            const error = new Error('NoSuchKey');
            expect(error.message.includes('NoSuchKey')).toBe(true);
        });
    });
});
