/**
 * @fileoverview Unit tests for audit service.
 * 
 * Tests audit logging and query functionality with mocked database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne } from '../../src/db/index.js';
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from '../../src/services/audit.service.js';

// Get mocked functions
const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuditAction constants', () => {
    it('should have user management actions', () => {
      expect(AuditAction.CREATE_USER).toBe('create_user');
      expect(AuditAction.UPDATE_USER).toBe('update_user');
      expect(AuditAction.DELETE_USER).toBe('delete_user');
      expect(AuditAction.UPDATE_ROLE).toBe('update_role');
    });

    it('should have storage actions', () => {
      expect(AuditAction.CREATE_BUCKET).toBe('create_bucket');
      expect(AuditAction.DELETE_BUCKET).toBe('delete_bucket');
      expect(AuditAction.UPLOAD_FILE).toBe('upload_file');
      expect(AuditAction.DELETE_FILE).toBe('delete_file');
      expect(AuditAction.DOWNLOAD_FILE).toBe('download_file');
      expect(AuditAction.CREATE_FOLDER).toBe('create_folder');
      expect(AuditAction.DELETE_FOLDER).toBe('delete_folder');
    });

    it('should have configuration actions', () => {
      expect(AuditAction.UPDATE_CONFIG).toBe('update_config');
      expect(AuditAction.RELOAD_CONFIG).toBe('reload_config');
    });

    it('should have system actions', () => {
      expect(AuditAction.RUN_MIGRATION).toBe('run_migration');
      expect(AuditAction.SYSTEM_START).toBe('system_start');
      expect(AuditAction.SYSTEM_STOP).toBe('system_stop');
    });
  });

  describe('AuditResourceType constants', () => {
    it('should have all resource types', () => {
      expect(AuditResourceType.USER).toBe('user');
      expect(AuditResourceType.SESSION).toBe('session');
      expect(AuditResourceType.BUCKET).toBe('bucket');
      expect(AuditResourceType.FILE).toBe('file');
      expect(AuditResourceType.CONFIG).toBe('config');
      expect(AuditResourceType.SYSTEM).toBe('system');
      expect(AuditResourceType.ROLE).toBe('role');
    });
  });

  describe('log', () => {
    it('should insert audit log entry', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1 });

      const result = await auditService.log({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: AuditAction.UPDATE_ROLE,
        resourceType: AuditResourceType.USER,
        resourceId: 'target-user-456',
        details: { oldRole: 'user', newRole: 'manager' },
        ipAddress: '192.168.1.1',
      });

      expect(result).toBe(1);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'test@example.com',
          AuditAction.UPDATE_ROLE,
          AuditResourceType.USER,
          'target-user-456',
          expect.any(String), // JSON details
          '192.168.1.1',
        ])
      );
    });

    it('should handle null userId for system actions', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 2 });

      const result = await auditService.log({
        userEmail: 'system',
        action: AuditAction.SYSTEM_START,
        resourceType: AuditResourceType.SYSTEM,
      });

      expect(result).toBe(2);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]) // null userId
      );
    });

    it('should default details to empty object', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 3 });

      await auditService.log({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: AuditAction.DELETE_FILE,
        resourceType: AuditResourceType.FILE,
      });

      // The details should be serialized as '{}'
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{}'])
      );
    });

    it('should return null on database error', async () => {
      mockQueryOne.mockRejectedValueOnce(new Error('Database error'));

      const result = await auditService.log({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: AuditAction.CREATE_USER,
        resourceType: AuditResourceType.USER,
      });

      expect(result).toBeNull();
    });

    it('should return null when queryOne returns undefined', async () => {
      mockQueryOne.mockResolvedValueOnce(undefined);

      const result = await auditService.log({
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: AuditAction.CREATE_USER,
        resourceType: AuditResourceType.USER,
      });

      expect(result).toBeNull();
    });
  });

  describe('getLogs', () => {
    const mockLogEntries = [
      {
        id: 1,
        user_id: 'user-1',
        user_email: 'user1@example.com',
        action: 'update_role',
        resource_type: 'user',
        resource_id: 'target-1',
        details: '{"oldRole":"user","newRole":"manager"}',
        ip_address: '192.168.1.1',
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        user_id: 'user-2',
        user_email: 'user2@example.com',
        action: 'delete_file',
        resource_type: 'file',
        resource_id: 'file-123',
        details: '{"filename":"document.pdf"}',
        ip_address: '192.168.1.2',
        created_at: '2024-01-15T11:00:00Z',
      },
    ];

    it('should return paginated logs', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '2' });
      mockQuery.mockResolvedValueOnce(mockLogEntries);

      const result = await auditService.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should parse JSON details', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([mockLogEntries[0]]);

      const result = await auditService.getLogs();

      expect(result.data[0]?.details).toEqual({ oldRole: 'user', newRole: 'manager' });
    });

    it('should handle already-parsed details', async () => {
      const entryWithParsedDetails = {
        ...mockLogEntries[0],
        details: { alreadyParsed: true },
      };
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([entryWithParsedDetails]);

      const result = await auditService.getLogs();

      expect(result.data[0]?.details).toEqual({ alreadyParsed: true });
    });

    it('should filter by userId', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([mockLogEntries[0]]);

      await auditService.getLogs({ userId: 'user-1' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $'),
        expect.arrayContaining(['user-1'])
      );
    });

    it('should filter by action', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([mockLogEntries[0]]);

      await auditService.getLogs({ action: 'update_role' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('action = $'),
        expect.arrayContaining(['update_role'])
      );
    });

    it('should filter by resourceType', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([]);

      await auditService.getLogs({ resourceType: 'file' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $'),
        expect.arrayContaining(['file'])
      );
    });

    it('should filter by date range', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      await auditService.getLogs({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $'),
        expect.arrayContaining(['2024-01-01', '2024-01-31'])
      );
    });

    it('should filter by search term', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      await auditService.getLogs({ search: 'test@example' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test@example%'])
      );
    });

    it('should sanitize search term for LIKE/ILIKE', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      await auditService.getLogs({ search: '50%_off\\' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['%50\\%\\_off\\\\%'])
      );
    });

    it('should handle empty results', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      const result = await auditService.getLogs();

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should use default pagination values', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '100' });
      mockQuery.mockResolvedValueOnce([]);

      const result = await auditService.getLogs();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('should calculate correct offset for pagination', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '100' });
      mockQuery.mockResolvedValueOnce([]);

      await auditService.getLogs({ page: 3, limit: 20 });

      // Offset should be (3-1) * 20 = 40
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([20, 40]) // limit, offset
      );
    });
  });

  describe('getActionTypes', () => {
    it('should return distinct action types', async () => {
      mockQuery.mockResolvedValueOnce([
        { action: 'create_user' },
        { action: 'delete_file' },
        { action: 'update_role' },
      ]);

      const result = await auditService.getActionTypes();

      expect(result).toEqual(['create_user', 'delete_file', 'update_role']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT action')
      );
    });

    it('should return empty array when no logs exist', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await auditService.getActionTypes();

      expect(result).toEqual([]);
    });
  });

  describe('getResourceTypes', () => {
    it('should return distinct resource types', async () => {
      mockQuery.mockResolvedValueOnce([
        { resource_type: 'file' },
        { resource_type: 'user' },
        { resource_type: 'bucket' },
      ]);

      const result = await auditService.getResourceTypes();

      expect(result).toEqual(['file', 'user', 'bucket']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT resource_type')
      );
    });
  });

  describe('deleteOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '15' });

      const result = await auditService.deleteOldLogs(30);

      expect(result).toBe(15);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM audit_logs'),
        [30]
      );
    });

    it('should handle zero deleted records', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });

      const result = await auditService.deleteOldLogs(365);

      expect(result).toBe(0);
    });

    it('should throw error for invalid days value', async () => {
      await expect(auditService.deleteOldLogs(NaN)).rejects.toThrow('Invalid olderThanDays value');
    });

    it('should floor decimal values', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '5' });

      await auditService.deleteOldLogs(30.7);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        [30]
      );
    });

    it('should enforce minimum of 1 day', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });

      await auditService.deleteOldLogs(0);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        [1]
      );
    });
  });
});
