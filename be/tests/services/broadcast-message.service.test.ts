
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { broadcastMessageService } from '../../src/services/broadcast-message.service.js';
import { getAdapter } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.service.js';

// Mock dependencies
vi.mock('../../src/db/index.js');
vi.mock('../../src/services/logger.service.js');
vi.mock('../../src/services/audit.service.js');

describe('BroadcastMessageService', () => {
    let mockDb: any;

    beforeEach(() => {
        vi.resetAllMocks();
        mockDb = {
            query: vi.fn(),
        };
        vi.mocked(getAdapter).mockResolvedValue(mockDb);
    });

    describe('createMessage', () => {
        it('should create message and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const messageData = {
                message: 'Test Message',
                starts_at: '2023-01-01T00:00:00Z',
                ends_at: '2023-01-02T00:00:00Z',
                color: '#000000',
                font_color: '#FFFFFF',
                is_active: true,
                is_dismissible: true
            };
            const createdMessage = { id: 'msg1', ...messageData };

            mockDb.query.mockResolvedValue([createdMessage]);

            const result = await broadcastMessageService.createMessage(messageData, user);

            expect(result).toEqual(createdMessage);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'create_broadcast',
                resourceId: 'msg1',
                details: { message: 'Test Message' }
            }));
        });
    });

    describe('updateMessage', () => {
        it('should update message and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const messageData = { message: 'Updated Message' };
            const updatedMessage = { id: 'msg1', ...messageData };

            mockDb.query.mockResolvedValue([updatedMessage]);

            const result = await broadcastMessageService.updateMessage('msg1', messageData, user);

            expect(result).toEqual(updatedMessage);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'update_broadcast',
                resourceId: 'msg1',
                details: { changes: messageData }
            }));
        });
    });

    describe('deleteMessage', () => {
        it('should delete message and log audit event when user is provided', async () => {
            const user = { id: 'user1', email: 'user1@example.com' };
            const message = { id: 'msg1', message: 'Message to delete' };

            // Mock find then delete
            mockDb.query
                .mockResolvedValueOnce([message]) // Fetch message
                .mockResolvedValueOnce([{ rowCount: 1 }]); // Delete result

            await broadcastMessageService.deleteMessage('msg1', user);

            expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM broadcast_messages WHERE id = $1', ['msg1']);
            expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM broadcast_messages WHERE id = $1', ['msg1']);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: user.id,
                action: 'delete_broadcast',
                resourceId: 'msg1',
                details: { message: 'Message to delete' }
            }));
        });
    });

    describe('dismissMessage', () => {
        it('should dismiss message and log audit event', async () => {
            const userId = 'user1';
            const userEmail = 'user1@example.com';
            mockDb.query.mockResolvedValue({} as any);

            await broadcastMessageService.dismissMessage(userId, 'msg1', userEmail);

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId,
                userEmail,
                action: 'dismiss_broadcast',
                resourceId: 'msg1'
            }));
        });
    });
});
