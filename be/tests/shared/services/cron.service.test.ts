/**
 * @fileoverview Comprehensive unit tests for cron service.
 * Tests scheduled cleanup jobs, file expiration, error handling, and directory management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock dependencies
const mockLog = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockConfig = {
  tempFileCleanupSchedule: '0 3 * * *', // Daily at 3 AM
  tempFileTTL: 3600000, // 1 hour in ms
  tempCachePath: '/tmp/test-cache',
};

const mockFsPromises = {
  access: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
};

const mockCron = {
  schedule: vi.fn(),
};

vi.mock('../../../src/shared/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('fs/promises', () => ({
  default: mockFsPromises,
}));

vi.mock('fs', () => ({
  constants: {
    F_OK: 0,
  },
}));

vi.mock('node-cron', () => ({
  default: mockCron,
}));

describe('CronService', () => {
  let cronService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const module = await import('../../../src/shared/services/cron.service.js');
    cronService = module.cronService;
  });

  describe('startCleanupJob', () => {
    it('should schedule cleanup job with correct cron pattern', () => {
      cronService.startCleanupJob();

      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 3 * * *',
        expect.any(Function)
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        'Starting temp file cleanup cron job',
        expect.objectContaining({
          schedule: '0 3 * * *',
          ttlMs: 3600000,
          tempPath: '/tmp/test-cache',
        })
      );
    });
  });

  describe('runCleanup (via scheduled execution)', () => {
    it('should skip cleanup when temp directory does not exist', async () => {
      mockFsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));

      // Start job and trigger callback
      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockLog.warn).toHaveBeenCalledWith(
        'Temp directory does not exist, skipping cleanup',
        { tempPath: '/tmp/test-cache' }
      );
      expect(mockFsPromises.readdir).not.toHaveBeenCalled();
    });

    it('should delete expired files successfully', async () => {
      const now = Date.now();
      const expiredMtime = now - 7200000; // 2 hours old (expired)

      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce(['file1.pdf', 'file2.jpg']);
      mockFsPromises.stat
        .mockResolvedValueOnce({ mtimeMs: expiredMtime })
        .mockResolvedValueOnce({ mtimeMs: expiredMtime });
      mockFsPromises.unlink.mockResolvedValue(undefined);

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockFsPromises.readdir).toHaveBeenCalledWith('/tmp/test-cache');
      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        path.join('/tmp/test-cache', 'file1.pdf')
      );
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        path.join('/tmp/test-cache', 'file2.jpg')
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        'Temp file cleanup completed',
        expect.objectContaining({
          deletedCount: 2,
          errorCount: 0,
          totalScanned: 2,
        })
      );
    });

    it('should skip files that are not expired', async () => {
      const now = Date.now();
      const recentMtime = now - 1800000; // 30 minutes old (not expired with 1hr TTL)

      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce(['recent-file.pdf']);
      mockFsPromises.stat.mockResolvedValueOnce({ mtimeMs: recentMtime });

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockFsPromises.unlink).not.toHaveBeenCalled();
      expect(mockLog.debug).toHaveBeenCalledWith(
        'Temp file cleanup completed - no files expired'
      );
    });

    it('should handle mixed expired and non-expired files', async () => {
      const now = Date.now();
      const expiredMtime = now - 7200000; // 2 hours old
      const recentMtime = now - 1800000; // 30 minutes old

      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce([
        'expired1.pdf',
        'recent.jpg',
        'expired2.doc',
      ]);
      mockFsPromises.stat
        .mockResolvedValueOnce({ mtimeMs: expiredMtime })
        .mockResolvedValueOnce({ mtimeMs: recentMtime })
        .mockResolvedValueOnce({ mtimeMs: expiredMtime });
      mockFsPromises.unlink.mockResolvedValue(undefined);

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
      expect(mockLog.info).toHaveBeenCalledWith(
        'Temp file cleanup completed',
        expect.objectContaining({
          deletedCount: 2,
          errorCount: 0,
          totalScanned: 3,
        })
      );
    });

    it('should handle file deletion errors gracefully', async () => {
      const now = Date.now();
      const expiredMtime = now - 7200000;

      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce(['locked-file.pdf']);
      mockFsPromises.stat.mockResolvedValueOnce({ mtimeMs: expiredMtime });
      mockFsPromises.unlink.mockRejectedValueOnce(new Error('Permission denied'));

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Error processing file during cleanup',
        expect.objectContaining({
          file: 'locked-file.pdf',
          error: expect.any(Error),
        })
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        'Temp file cleanup completed',
        expect.objectContaining({
          deletedCount: 0,
          errorCount: 1,
        })
      );
    });

    it('should handle stat errors gracefully', async () => {
      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce(['inaccessible-file.pdf']);
      mockFsPromises.stat.mockRejectedValueOnce(new Error('File not found'));

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Error processing file during cleanup',
        expect.objectContaining({
          file: 'inaccessible-file.pdf',
        })
      );
    });

    it('should handle empty directory', async () => {
      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce([]);

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockFsPromises.stat).not.toHaveBeenCalled();
      expect(mockFsPromises.unlink).not.toHaveBeenCalled();
      expect(mockLog.debug).toHaveBeenCalledWith(
        'Temp file cleanup completed - no files expired'
      );
    });

    it('should handle critical errors in cleanup job', async () => {
      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockRejectedValueOnce(new Error('Disk failure'));

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Critical error in temp file cleanup job',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should log debug message for each deleted file', async () => {
      const now = Date.now();
      const expiredMtime = now - 7200000;

      mockFsPromises.access.mockResolvedValueOnce(undefined);
      mockFsPromises.readdir.mockResolvedValueOnce(['test-file.pdf']);
      mockFsPromises.stat.mockResolvedValueOnce({ mtimeMs: expiredMtime });
      mockFsPromises.unlink.mockResolvedValue(undefined);

      cronService.startCleanupJob();
      const scheduledCallback = mockCron.schedule.mock.calls[0][1];
      await scheduledCallback();

      expect(mockLog.debug).toHaveBeenCalledWith(
        'Deleted expired temp file',
        expect.objectContaining({
          file: 'test-file.pdf',
          age: expect.any(Number),
        })
      );
    });
  });
});
