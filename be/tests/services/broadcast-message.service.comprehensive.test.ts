import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditLog = vi.hoisted(() => vi.fn());
const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
}));
const mockBroadcastMessageModel = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findActive: vi.fn(),
  findActiveExcludingDismissed: vi.fn(),
}));
const mockUserDismissedBroadcastModel = vi.hoisted(() => ({
  upsertDismissal: vi.fn(),
}));

// Mock dependencies BEFORE importing the service
vi.mock('../../src/db/index.js');
vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: {
    log: mockAuditLog,
  },
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

describe('BroadcastMessageService - Comprehensive', () => {
    let service: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('../../src/services/broadcast-message.service.js');
        service = module.broadcastMessageService;
    });

    describe('getActiveMessages', () => {
        it('should return all active messages for guests', async () => {
            const mockMessages = [
                { id: '1', message: 'Test 1', is_active: true },
                { id: '2', message: 'Test 2', is_active: true },
            ];
            mockBroadcastMessageModel.findActive.mockResolvedValue(mockMessages);

            const result = await service.getActiveMessages();

            expect(mockBroadcastMessageModel.findActive).toHaveBeenCalledWith(expect.any(String));
            expect(result).toEqual(mockMessages);
        });

        it('should return active messages excluding dismissed for logged-in users', async () => {
            const mockMessages = [{ id: '1', message: 'Test', is_active: true }];
            mockBroadcastMessageModel.findActiveExcludingDismissed.mockResolvedValue(mockMessages);

            const result = await service.getActiveMessages('user-123');

            expect(mockBroadcastMessageModel.findActiveExcludingDismissed).toHaveBeenCalledWith(
                'user-123',
                expect.any(String)
            );
            expect(result).toEqual(mockMessages);
        });
    });

    describe('dismissMessage', () => {
        it('should record dismissal and log audit event', async () => {
            mockUserDismissedBroadcastModel.upsertDismissal.mockResolvedValue(undefined);
            mockAuditLog.mockResolvedValue(undefined);

            await service.dismissMessage('user-123', 'broadcast-456', 'user@test.com', '127.0.0.1');

            expect(mockUserDismissedBroadcastModel.upsertDismissal).toHaveBeenCalledWith(
                'user-123',
                'broadcast-456'
            );
            expect(mockAuditLog).toHaveBeenCalledWith({
                userId: 'user-123',
                userEmail: 'user@test.com',
                action: 'dismiss_broadcast',
                resourceType: 'broadcast_message',
                resourceId: 'broadcast-456',
                ipAddress: '127.0.0.1',
            });
            expect(mockLog.info).toHaveBeenCalled();
        });
    });

    describe('createMessage', () => {
        const mockData = {
            message: 'New broadcast',
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-12-31T23:59:59Z',
        };

        it('should create message with default values', async () => {
            const createdMessage = { id: '123', ...mockData, color: '#E75E40', font_color: '#FFFFFF' };
            mockBroadcastMessageModel.create.mockResolvedValue(createdMessage);

            const result = await service.createMessage(mockData);

            expect(mockBroadcastMessageModel.create).toHaveBeenCalledWith({
                message: mockData.message,
                starts_at: mockData.starts_at,
                ends_at: mockData.ends_at,
                color: '#E75E40',
                font_color: '#FFFFFF',
                is_active: true,
                is_dismissible: false,
            });
            expect(result).toEqual(createdMessage);
        });
    });

    describe('updateMessage', () => {
        it('should update message with provided fields', async () => {
            const updateData = { message: 'Updated message', is_active: false };
            const updatedMessage = { id: '123', ...updateData };
            mockBroadcastMessageModel.update.mockResolvedValue(updatedMessage);

            const result = await service.updateMessage('123', updateData);

            expect(mockBroadcastMessageModel.update).toHaveBeenCalledWith('123', updateData);
            expect(result).toEqual(updatedMessage);
        });
    });

    describe('deleteMessage', () => {
        it('should delete message and log audit event', async () => {
            const message = { id: '123', message: 'Test message' };
            mockBroadcastMessageModel.findById.mockResolvedValue(message);
            mockBroadcastMessageModel.delete.mockResolvedValue(undefined);

            const user = { id: 'admin', email: 'admin@test.com', ip: '127.0.0.1' };
            const result = await service.deleteMessage('123', user);

            expect(mockBroadcastMessageModel.findById).toHaveBeenCalledWith('123');
            expect(mockBroadcastMessageModel.delete).toHaveBeenCalledWith('123');
            expect(mockAuditLog).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});
