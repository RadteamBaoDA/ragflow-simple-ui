/**
 * @fileoverview Unit tests for RAGFlow configuration service.
 * Tests config loading from database, management methods,
 * and pagination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ragflowService } from '../../src/services/ragflow.service.js';
import { db } from '../../src/db/index.js';

// Mock logger to avoid console noise
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock db
vi.mock('../../src/db/index.js', () => ({
    db: {
        query: vi.fn(),
        queryOne: vi.fn(),
    },
}));

describe('RagflowService', () => {
    const mockChatSource = { id: 'chat1', type: 'chat', name: 'Chat Source 1', url: 'https://chat1.example.com' };
    const mockSearchSource = { id: 'search1', type: 'search', name: 'Search Source 1', url: 'https://search1.example.com' };
    const mockSources = [mockChatSource, mockSearchSource];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getConfig', () => {
        it('should return the full configuration object with default IDs and sources', async () => {
            vi.mocked(db.queryOne).mockImplementation(async (sql, params) => {
                if (params && params[0] === 'default_chat_source_id') return { value: 'chat1' };
                if (params && params[0] === 'default_search_source_id') return { value: 'search1' };
                return undefined;
            });
            vi.mocked(db.query).mockResolvedValue(mockSources);

            const config = await ragflowService.getConfig();

            expect(config).toEqual({
                defaultChatSourceId: 'chat1',
                defaultSearchSourceId: 'search1',
                chatSources: [mockChatSource],
                searchSources: [mockSearchSource],
            });
            expect(db.queryOne).toHaveBeenCalledTimes(2);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('should return empty strings for default IDs if not found', async () => {
            vi.mocked(db.queryOne).mockResolvedValue(undefined);
            vi.mocked(db.query).mockResolvedValue([]);

            const config = await ragflowService.getConfig();

            expect(config).toEqual({
                defaultChatSourceId: '',
                defaultSearchSourceId: '',
                chatSources: [],
                searchSources: [],
            });
        });
    });

    describe('getAllSources', () => {
        it('should return all sources separated by type', async () => {
            vi.mocked(db.query).mockResolvedValue(mockSources);

            const result = await ragflowService.getAllSources();

            expect(result).toEqual({
                chatSources: [mockChatSource],
                searchSources: [mockSearchSource],
            });
        });
    });

    describe('getSourcesPaginated', () => {
        it('should return paginated sources', async () => {
            vi.mocked(db.queryOne).mockResolvedValue({ count: '10' });
            vi.mocked(db.query).mockResolvedValue([mockChatSource]);

            const result = await ragflowService.getSourcesPaginated('chat', 1, 10);

            expect(result).toEqual({
                data: [mockChatSource],
                total: 10,
                page: 1,
                limit: 10,
            });
            expect(db.queryOne).toHaveBeenCalledWith(expect.stringContaining('COUNT'), ['chat']);
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), ['chat', 10, 0]);
        });
    });

    describe('saveSystemConfig', () => {
        it('should insert or update system config', async () => {
            await ragflowService.saveSystemConfig('default_chat_source_id', 'new-id');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO system_configs'),
                ['default_chat_source_id', 'new-id']
            );
        });
    });

    describe('addSource', () => {
        it('should add a new source', async () => {
            const result = await ragflowService.addSource('chat', 'New Chat', 'http://new.com');

            expect(result).toHaveProperty('id');
            expect(result.type).toBe('chat');
            expect(result.name).toBe('New Chat');
            expect(result.url).toBe('http://new.com');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ragflow_sources'),
                [expect.any(String), 'chat', 'New Chat', 'http://new.com']
            );
        });
    });

    describe('updateSource', () => {
        it('should update an existing source', async () => {
            await ragflowService.updateSource('id-123', 'Updated Name', 'http://updated.com');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE ragflow_sources'),
                ['Updated Name', 'http://updated.com', 'id-123']
            );
        });
    });

    describe('deleteSource', () => {
        it('should delete a source', async () => {
            await ragflowService.deleteSource('id-123');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM ragflow_sources'),
                ['id-123']
            );
        });
    });
});
