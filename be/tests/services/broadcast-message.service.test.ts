/**
 * @fileoverview Unit tests for broadcast message service.
 * 
 * Tests service layer operations using ModelFactory pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

const mockAuditService = vi.hoisted(() => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

const mockBroadcastMessageModel = vi.hoisted(() => ({
  findActive: vi.fn(),
  findActiveExcludingDismissed: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockUserDismissedBroadcastModel = vi.hoisted(() => ({
  upsertDismissal: vi.fn(),
}));

// Apply mocks
vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: mockAuditService,
  AuditAction: {
    CREATE_BROADCAST: 'create_broadcast',
    UPDATE_BROADCAST: 'update_broadcast',
    DELETE_BROADCAST: 'delete_broadcast',
    DISMISS_BROADCAST: 'dismiss_broadcast',
  },
  AuditResourceType: {
    BROADCAST_MESSAGE: 'broadcast_message',
  },
}));

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    broadcastMessage: mockBroadcastMessageModel,
    userDismissedBroadcast: mockUserDismissedBroadcastModel,
  },
}));

describe('BroadcastMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveMessages', () => {
    it('should return all active messages when userId not provided', async () => {
      const activeMessages = [
        { id: 'msg1', message: 'Message 1', is_active: true },
        { id: 'msg2', message: 'Message 2', is_active: true }
      ];
      mockBroadcastMessageModel.findActive.mockResolvedValue(activeMessages);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.getActiveMessages();

      expect(mockBroadcastMessageModel.findActive).toHaveBeenCalledWith(expect.any(String));
      expect(mockBroadcastMessageModel.findActiveExcludingDismissed).not.toHaveBeenCalled();
      expect(result).toEqual(activeMessages);
    });

    it('should return active messages excluding dismissed when userId provided', async () => {
      const userId = 'user123';
      const activeMessages = [{ id: 'msg1', message: 'Not dismissed', is_active: true }];
      mockBroadcastMessageModel.findActiveExcludingDismissed.mockResolvedValue(activeMessages);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.getActiveMessages(userId);

      expect(mockBroadcastMessageModel.findActiveExcludingDismissed).toHaveBeenCalledWith(userId, expect.any(String));
      expect(mockBroadcastMessageModel.findActive).not.toHaveBeenCalled();
      expect(result).toEqual(activeMessages);
    });

    it('should return empty array when no active messages', async () => {
      mockBroadcastMessageModel.findActive.mockResolvedValue([]);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.getActiveMessages();

      expect(result).toEqual([]);
    });

    it('should rethrow error on failure', async () => {
      const error = new Error('Database error');
      mockBroadcastMessageModel.findActive.mockRejectedValue(error);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();

      await expect(service.getActiveMessages()).rejects.toThrow('Database error');
    });
  });

  describe('dismissMessage', () => {
    it('should record dismissal and log audit event', async () => {
      const userId = 'user123';
      const broadcastId = 'msg1';
      const userEmail = 'user@example.com';
      const ipAddress = '192.168.1.1';
      mockUserDismissedBroadcastModel.upsertDismissal.mockResolvedValue(undefined);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.dismissMessage(userId, broadcastId, userEmail, ipAddress);

      expect(mockUserDismissedBroadcastModel.upsertDismissal).toHaveBeenCalledWith(userId, broadcastId);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        userEmail,
        action: 'dismiss_broadcast',
        resourceType: 'broadcast_message',
        resourceId: broadcastId,
        ipAddress,
      });
      expect(mockLog.info).toHaveBeenCalledWith('Broadcast message dismissed by user', { userId, broadcastId });
    });

    it('should use unknown email when not provided', async () => {
      const userId = 'user123';
      const broadcastId = 'msg1';
      mockUserDismissedBroadcastModel.upsertDismissal.mockResolvedValue(undefined);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.dismissMessage(userId, broadcastId);

      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({ userEmail: 'unknown' }));
    });

    it('should log error and rethrow on dismissal failure', async () => {
      const error = new Error('Upsert failed');
      const userId = 'user123';
      const broadcastId = 'msg1';
      mockUserDismissedBroadcastModel.upsertDismissal.mockRejectedValue(error);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();

      await expect(service.dismissMessage(userId, broadcastId)).rejects.toThrow('Upsert failed');
      expect(mockLog.error).toHaveBeenCalledWith('Failed to dismiss broadcast message', expect.objectContaining({ userId, broadcastId }));
    });
  });

  describe('getAllMessages', () => {
    it('should return all messages ordered by created_at desc', async () => {
      const allMessages = [
        { id: 'msg2', message: 'Newer', created_at: '2024-01-02' },
        { id: 'msg1', message: 'Older', created_at: '2024-01-01' }
      ];
      mockBroadcastMessageModel.findAll.mockResolvedValue(allMessages);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.getAllMessages();

      expect(mockBroadcastMessageModel.findAll).toHaveBeenCalledWith({}, { orderBy: { created_at: 'desc' } });
      expect(result).toEqual(allMessages);
    });

    it('should rethrow error on failure', async () => {
      const error = new Error('Query failed');
      mockBroadcastMessageModel.findAll.mockRejectedValue(error);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();

      await expect(service.getAllMessages()).rejects.toThrow('Query failed');
    });
  });

  describe('createMessage', () => {
    it('should create message with defaults and log audit event', async () => {
      const messageData = {
        message: 'New announcement',
        starts_at: '2024-01-01T00:00:00Z',
        ends_at: '2024-12-31T23:59:59Z',
      };
      const user = { id: 'user1', email: 'admin@example.com', ip: '192.168.1.1' };
      const createdMessage = { id: 'msg1', ...messageData, color: '#E75E40', font_color: '#FFFFFF', is_active: true, is_dismissible: false };
      mockBroadcastMessageModel.create.mockResolvedValue(createdMessage);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.createMessage(messageData as any, user);

      expect(mockBroadcastMessageModel.create).toHaveBeenCalledWith({
        message: messageData.message,
        starts_at: messageData.starts_at,
        ends_at: messageData.ends_at,
        color: '#E75E40',
        font_color: '#FFFFFF',
        is_active: true,
        is_dismissible: false,
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: user.id,
        userEmail: user.email,
        action: 'create_broadcast',
        resourceType: 'broadcast_message',
        resourceId: 'msg1',
        details: { message: messageData.message },
        ipAddress: user.ip,
      });
      expect(result).toEqual(createdMessage);
    });

    it('should use provided color and font_color values', async () => {
      const messageData = {
        message: 'Custom styled',
        starts_at: '2024-01-01',
        ends_at: '2024-12-31',
        color: '#FF0000',
        font_color: '#000000',
        is_active: false,
        is_dismissible: true,
      };
      const createdMessage = { id: 'msg2', ...messageData };
      mockBroadcastMessageModel.create.mockResolvedValue(createdMessage);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.createMessage(messageData as any);

      expect(mockBroadcastMessageModel.create).toHaveBeenCalledWith(expect.objectContaining({
        color: '#FF0000',
        font_color: '#000000',
        is_active: false,
        is_dismissible: true,
      }));
    });

    it('should not log audit event when user not provided', async () => {
      const messageData = {
        message: 'No user',
        starts_at: '2024-01-01',
        ends_at: '2024-12-31',
      };
      const createdMessage = { id: 'msg3', ...messageData };
      mockBroadcastMessageModel.create.mockResolvedValue(createdMessage);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.createMessage(messageData as any);

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should throw error when create returns null', async () => {
      const messageData = {
        message: 'Failed',
        starts_at: '2024-01-01',
        ends_at: '2024-12-31',
      };
      mockBroadcastMessageModel.create.mockResolvedValue(null);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();

      await expect(service.createMessage(messageData as any)).rejects.toThrow('Failed to create broadcast message: No result returned');
      expect(mockLog.error).toHaveBeenCalledWith('Failed to create broadcast message', expect.any(Object));
    });
  });

  describe('updateMessage', () => {
    it('should update message fields and log audit event', async () => {
      const id = 'msg1';
      const updateData = { message: 'Updated text', is_active: false };
      const user = { id: 'user1', email: 'admin@example.com', ip: '192.168.1.1' };
      const updatedMessage = { id, ...updateData };
      mockBroadcastMessageModel.update.mockResolvedValue(updatedMessage);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.updateMessage(id, updateData, user);

      expect(mockBroadcastMessageModel.update).toHaveBeenCalledWith(id, { message: 'Updated text', is_active: false });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: user.id,
        userEmail: user.email,
        action: 'update_broadcast',
        resourceType: 'broadcast_message',
        resourceId: id,
        details: { changes: updateData },
        ipAddress: user.ip,
      });
      expect(result).toEqual(updatedMessage);
    });

    it('should return null when no fields to update', async () => {
      const id = 'msg1';
      const updateData = {};
      const user = { id: 'user1', email: 'admin@example.com' };

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.updateMessage(id, updateData, user);

      expect(mockBroadcastMessageModel.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle all updatable fields', async () => {
      const id = 'msg1';
      const updateData = {
        message: 'New message',
        starts_at: '2024-02-01',
        ends_at: '2024-02-28',
        color: '#00FF00',
        font_color: '#FFFFFF',
        is_active: true,
        is_dismissible: true,
      };
      mockBroadcastMessageModel.update.mockResolvedValue({ id, ...updateData });

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.updateMessage(id, updateData);

      expect(mockBroadcastMessageModel.update).toHaveBeenCalledWith(id, updateData);
    });

    it('should not log audit when user not provided', async () => {
      const id = 'msg1';
      const updateData = { message: 'Updated' };
      mockBroadcastMessageModel.update.mockResolvedValue({ id, ...updateData });

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.updateMessage(id, updateData);

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should return null when update returns null', async () => {
      const id = 'msg1';
      const updateData = { message: 'Updated' };
      const user = { id: 'user1', email: 'admin@example.com' };
      mockBroadcastMessageModel.update.mockResolvedValue(null);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.updateMessage(id, updateData, user);

      expect(result).toBeNull();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should delete message and log audit event', async () => {
      const id = 'msg1';
      const user = { id: 'user1', email: 'admin@example.com', ip: '192.168.1.1' };
      const message = { id, message: 'To be deleted' };
      mockBroadcastMessageModel.findById.mockResolvedValue(message);
      mockBroadcastMessageModel.delete.mockResolvedValue(undefined);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      const result = await service.deleteMessage(id, user);

      expect(mockBroadcastMessageModel.findById).toHaveBeenCalledWith(id);
      expect(mockBroadcastMessageModel.delete).toHaveBeenCalledWith(id);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: user.id,
        userEmail: user.email,
        action: 'delete_broadcast',
        resourceType: 'broadcast_message',
        resourceId: id,
        details: { message: 'To be deleted' },
        ipAddress: user.ip,
      });
      expect(result).toBe(true);
    });

    it('should not log audit when user not provided', async () => {
      const id = 'msg1';
      mockBroadcastMessageModel.findById.mockResolvedValue({ id, message: 'Test' });
      mockBroadcastMessageModel.delete.mockResolvedValue(undefined);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();
      await service.deleteMessage(id);

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should log error and rethrow on delete failure', async () => {
      const id = 'msg1';
      const error = new Error('Delete failed');
      mockBroadcastMessageModel.findById.mockResolvedValue({ id });
      mockBroadcastMessageModel.delete.mockRejectedValue(error);

      const { BroadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      const service = new BroadcastMessageService();

      await expect(service.deleteMessage(id)).rejects.toThrow('Delete failed');
      expect(mockLog.error).toHaveBeenCalledWith('Failed to delete broadcast message', expect.objectContaining({ id }));
    });
  });

  describe('broadcastMessageService singleton', () => {
    it('should export singleton instance', async () => {
      const { broadcastMessageService } = await import('../../src/services/broadcast-message.service.js');
      
      expect(broadcastMessageService).toBeDefined();
      expect(broadcastMessageService.getActiveMessages).toBeDefined();
      expect(broadcastMessageService.dismissMessage).toBeDefined();
      expect(broadcastMessageService.getAllMessages).toBeDefined();
      expect(broadcastMessageService.createMessage).toBeDefined();
      expect(broadcastMessageService.updateMessage).toBeDefined();
      expect(broadcastMessageService.deleteMessage).toBeDefined();
    });
  });
});
