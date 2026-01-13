/**
 * @fileoverview Unit tests for audit service.
 * 
 * Tests audit logging and query functionality with mocked database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuditAction,
  AuditResourceType,
} from '../../src/services/audit.service.js';

const mockAuditLogModel = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  count: vi.fn(),
}));

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    auditLog: mockAuditLogModel,
  },
}));

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

describe('Audit Service', () => {
  let auditService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../../src/services/audit.service.js');
    auditService = module.auditService;
  });

  describe('AuditAction constants', () => {
    it('should have user management actions', () => {
      expect(AuditAction.CREATE_USER).toBe('create_user');
      expect(AuditAction.UPDATE_USER).toBe('update_user');
      expect(AuditAction.DELETE_USER).toBe('delete_user');
      expect(AuditAction.UPDATE_ROLE).toBe('update_role');
    });

    it('should have document actions', () => {
      expect(AuditAction.UPLOAD_DOCUMENT).toBe('upload_document');
      expect(AuditAction.DELETE_DOCUMENT).toBe('delete_document');
      expect(AuditAction.DOWNLOAD_DOCUMENT).toBe('download_document');
    });

    it('should have system actions', () => {
      expect(AuditAction.SYSTEM_START).toBe('system_start');
      expect(AuditAction.SYSTEM_STOP).toBe('system_stop');
    });

    it('should have team actions', () => {
      expect(AuditAction.CREATE_TEAM).toBe('create_team');
      expect(AuditAction.UPDATE_TEAM).toBe('update_team');
      expect(AuditAction.DELETE_TEAM).toBe('delete_team');
    });

    it('should have broadcast actions', () => {
      expect(AuditAction.CREATE_BROADCAST).toBe('create_broadcast');
      expect(AuditAction.UPDATE_BROADCAST).toBe('update_broadcast');
      expect(AuditAction.DELETE_BROADCAST).toBe('delete_broadcast');
      expect(AuditAction.DISMISS_BROADCAST).toBe('dismiss_broadcast');
    });
  });

  describe('AuditResourceType constants', () => {
    it('should have resource types', () => {
      expect(AuditResourceType.USER).toBe('user');
      expect(AuditResourceType.BUCKET).toBe('bucket');
      expect(AuditResourceType.FILE).toBe('file');
      expect(AuditResourceType.SYSTEM).toBe('system');
      expect(AuditResourceType.TEAM).toBe('team');
      expect(AuditResourceType.PERMISSION).toBe('permission');
    });
  });

  describe('log method', () => {
    it('should create audit log successfully', async () => {
      mockAuditLogModel.create.mockResolvedValue({ id: 123 });

      const result = await auditService.log({
        userId: 'user-1',
        userEmail: 'test@example.com',
        action: AuditAction.UPLOAD_DOCUMENT,
        resourceType: AuditResourceType.FILE,
        resourceId: 'file-1',
        details: { size: 100 },
        ipAddress: '127.0.0.1',
      });

      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        user_id: 'user-1',
        user_email: 'test@example.com',
        action: 'upload_document',
        resource_type: 'file',
        resource_id: 'file-1',
        details: '{"size":100}',
        ip_address: '127.0.0.1',
      });
      expect(result).toBe(123);
      expect(mockLog.debug).toHaveBeenCalled();
    });

    it('should handle null values', async () => {
      mockAuditLogModel.create.mockResolvedValue({ id: 456 });

      const result = await auditService.log({
        userEmail: 'test@example.com',
        action: AuditAction.SYSTEM_START,
        resourceType: AuditResourceType.SYSTEM,
      });

      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        user_id: null,
        user_email: 'test@example.com',
        action: 'system_start',
        resource_type: 'system',
        resource_id: null,
        details: '{}',
        ip_address: null,
      });
      expect(result).toBe(456);
    });

    it('should handle errors gracefully', async () => {
      mockAuditLogModel.create.mockRejectedValue(new Error('Database error'));

      const result = await auditService.log({
        userEmail: 'test@example.com',
        action: AuditAction.UPLOAD_DOCUMENT,
        resourceType: AuditResourceType.FILE,
      });

      expect(result).toBeNull();
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to create audit log',
        expect.objectContaining({
          error: 'Database error',
          action: 'upload_document',
          resourceType: 'file',
        })
      );
    });
  });

  describe('getLogs method', () => {
    it('should retrieve paginated logs', async () => {
      const mockLogs = [
        {
          id: 1,
          user_email: 'user@test.com',
          action: 'upload_file',
          resource_type: 'file',
          resource_id: 'file-1',
          details: '{"size":100}',
          created_at: new Date(),
        },
      ];

      mockAuditLogModel.findAll.mockResolvedValue(mockLogs);

      const result = await auditService.getLogs({}, 50, 0);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].details).toEqual({ size: 100 });
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('should apply filters', async () => {
      mockAuditLogModel.findAll.mockResolvedValue([]);

      await auditService.getLogs(
        { userId: 'user-1', action: 'upload_file', resourceType: 'file' },
        20,
        10
      );

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          action: 'upload_file',
          resource_type: 'file',
        },
        {
          orderBy: { created_at: 'desc' },
          limit: 20,
          offset: 10,
        }
      );
    });
  });

  describe('getResourceHistory method', () => {
    it('should retrieve history for specific resource', async () => {
      const mockLogs = [
        {
          id: 1,
          action: 'create',
          resource_type: 'bucket',
          resource_id: 'bucket-1',
          details: '{"name":"test"}',
          created_at: new Date(),
        },
      ];

      mockAuditLogModel.findAll.mockResolvedValue(mockLogs);

      const result = await auditService.getResourceHistory('bucket', 'bucket-1');

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        {
          resource_type: 'bucket',
          resource_id: 'bucket-1',
        },
        { orderBy: { created_at: 'desc' } }
      );
      expect(result).toHaveLength(1);
      expect(result[0].details).toEqual({ name: 'test' });
    });
  });

  describe('exportLogsToCsv method', () => {
    it('should export logs to CSV format', async () => {
      const mockLogs = [
        {
          id: 1,
          user_email: 'test@example.com',
          action: 'upload_file',
          resource_type: 'file',
          resource_id: 'file-1',
          ip_address: '127.0.0.1',
          created_at: '2024-01-01T00:00:00.000Z',
          details: { size: 100 },
        },
      ];

      mockAuditLogModel.findAll.mockResolvedValue(
        mockLogs.map(log => ({ ...log, details: JSON.stringify(log.details) }))
      );

      const csv = await auditService.exportLogsToCsv({});

      expect(csv).toContain('ID,User Email,Action,Resource Type');
      expect(csv).toContain('1,test@example.com,upload_file,file,file-1');
      expect(csv).toContain('""size"":100');
    });

    it('should return empty string for no logs', async () => {
      mockAuditLogModel.findAll.mockResolvedValue([]);

      const csv = await auditService.exportLogsToCsv({});

      expect(csv).toBe('');
    });
  });

  describe('getActionTypes method', () => {
    it('should return all action types', async () => {
      const types = await auditService.getActionTypes();

      expect(types).toContain('create_user');
      expect(types).toContain('upload_document');
      expect(types).toContain('system_start');
      expect(types.length).toBeGreaterThan(10);
    });
  });

  describe('getResourceTypes method', () => {
    it('should return all resource types', async () => {
      const types = await auditService.getResourceTypes();

      expect(types).toContain('user');
      expect(types).toContain('bucket');
      expect(types).toContain('file');
      expect(types).toContain('system');
    });
  });

  describe('deleteOldLogs method', () => {
    it('should return 0 (placeholder implementation)', async () => {
      const result = await auditService.deleteOldLogs(30);

      expect(result).toBe(0);
    });
  });
});

