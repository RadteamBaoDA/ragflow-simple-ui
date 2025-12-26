/**
 * @fileoverview Unit tests for preview service.
 * Tests file caching, bucket resolution, cache expiration, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fsPromises from 'fs/promises';
import { constants } from 'fs';

// Mock MinIO client
const mockMinioClient = {
  fGetObject: vi.fn(),
};

// Mock ModelFactory
const mockMinioBucketModel = {
  findById: vi.fn(),
};

const mockModelFactory = {
  minioBucket: mockMinioBucketModel,
};

// Mock logger
const mockLog = {
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock config
const mockConfig = {
  tempCachePath: '/tmp/preview-cache',
  tempFileTTL: 3600000, // 1 hour in ms
};

// Mock fs
const mockFsPromises = {
  access: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  utimes: vi.fn(),
};

vi.mock('../../src/models/external/minio.js', () => ({
  minioClient: mockMinioClient,
}));

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: mockModelFactory,
}));

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('fs/promises', () => ({
  default: mockFsPromises,
  access: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  utimes: vi.fn(),
}));

describe('PreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fs mock implementations
    Object.assign(mockFsPromises, {
      access: vi.fn(),
      stat: vi.fn(),
      unlink: vi.fn(),
      utimes: vi.fn(),
    });
  });

  describe('generatePreview', () => {
    it('should download and cache file when not in cache', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'test-file.pdf';
      
      // File not in cache
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should download file
      expect(mockMinioClient.fGetObject).toHaveBeenCalledWith(
        bucketName,
        fileName,
        expect.stringContaining('test-bucket_test-file.pdf')
      );
      
      // Should set file timestamps
      expect(mockFsPromises.utimes).toHaveBeenCalled();
      
      // Should log success
      expect(mockLog.info).toHaveBeenCalledWith(
        'File cached successfully',
        expect.objectContaining({ bucketName, fileName })
      );
      
      // Should return local file path
      expect(result).toContain('test-bucket_test-file.pdf');
    });

    it('should use cached file when within TTL', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'cached-file.pdf';
      const now = Date.now();
      
      // File exists and is recent
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.stat.mockResolvedValue({
        mtimeMs: now - 1000, // 1 second old, well within TTL
      });

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should NOT download file
      expect(mockMinioClient.fGetObject).not.toHaveBeenCalled();
      
      // Should log cache hit
      expect(mockLog.debug).toHaveBeenCalledWith(
        'Preview cache hit',
        expect.objectContaining({ bucketName, fileName })
      );
      
      // Should return local file path
      expect(result).toContain('test-bucket_cached-file.pdf');
    });

    it('should delete and re-download expired cache file', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'expired-file.pdf';
      const now = Date.now();
      
      // File exists but is expired
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.stat.mockResolvedValue({
        mtimeMs: now - mockConfig.tempFileTTL - 1000, // Expired by 1 second
      });
      mockFsPromises.unlink.mockResolvedValue(undefined);
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should delete expired file
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-bucket_expired-file.pdf')
      );
      
      // Should download fresh file
      expect(mockMinioClient.fGetObject).toHaveBeenCalled();
      
      // Should return local file path
      expect(result).toContain('test-bucket_expired-file.pdf');
    });

    it('should handle unlink error gracefully', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'file-delete-error.pdf';
      const now = Date.now();
      
      // File exists but is expired
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.stat.mockResolvedValue({
        mtimeMs: now - mockConfig.tempFileTTL - 1000,
      });
      mockFsPromises.unlink.mockRejectedValue(new Error('Permission denied'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should log error
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to delete expired cache file',
        expect.objectContaining({ error: expect.any(Error) })
      );
      
      // Should still attempt to download
      expect(mockMinioClient.fGetObject).toHaveBeenCalled();
      
      // Should return local file path
      expect(result).toContain('file-delete-error.pdf');
    });

    it('should resolve bucket name from UUID', async () => {
      const bucketId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const fileName = 'uuid-bucket-file.pdf';
      const actualBucketName = 'actual-bucket-name';
      
      // Mock bucket lookup
      mockMinioBucketModel.findById.mockResolvedValue({
        bucket_name: actualBucketName,
      });
      
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketId, fileName);

      // Should look up bucket by ID
      expect(mockMinioBucketModel.findById).toHaveBeenCalledWith(bucketId);
      
      // Should use actual bucket name for download
      expect(mockMinioClient.fGetObject).toHaveBeenCalledWith(
        actualBucketName,
        fileName,
        expect.any(String)
      );
      
      // Should return path with actual bucket name
      expect(result).toContain('actual-bucket-name');
    });

    it('should sanitize unsafe characters in file name', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'unsafe/../file name!@#$.pdf';
      
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should sanitize filename (dots and dashes are allowed, but spaces and special chars become underscores)
      // Slashes are replaced with underscores in the local filename
      expect(result).toContain('test-bucket_unsafe_.._file_name____.pdf');
      expect(result).not.toContain('!@#$');
      expect(result).not.toContain(' ');
    });

    it('should handle file path with slashes', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'folder/subfolder/file.pdf';
      
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketName, fileName);

      // Should replace slashes with underscores
      expect(result).toContain('test-bucket_folder_subfolder_file.pdf');
      expect(result).not.toMatch(/folder\/subfolder/);
    });

    it('should throw error when download fails', async () => {
      const bucketName = 'test-bucket';
      const fileName = 'download-error.pdf';
      const downloadError = new Error('MinIO connection failed');
      
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockRejectedValue(downloadError);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      // Should throw error
      await expect(service.generatePreview(bucketName, fileName)).rejects.toThrow('MinIO connection failed');
      
      // Should log error
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to download file for preview',
        expect.objectContaining({
          error: downloadError,
          bucketName,
          fileName,
        })
      );
    });

    it('should handle UUID bucket not found', async () => {
      const bucketId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const fileName = 'file.pdf';
      
      // Bucket not found, returns null
      mockMinioBucketModel.findById.mockResolvedValue(null);
      
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockMinioClient.fGetObject.mockResolvedValue(undefined);
      mockFsPromises.utimes.mockResolvedValue(undefined);

      const { PreviewService } = await import('../../src/services/preview.service.js');
      const service = new PreviewService();
      
      const result = await service.generatePreview(bucketId, fileName);

      // Should use original UUID as bucket name
      expect(mockMinioClient.fGetObject).toHaveBeenCalledWith(
        bucketId,
        fileName,
        expect.any(String)
      );
      
      expect(result).toContain(bucketId);
    });
  });
});
