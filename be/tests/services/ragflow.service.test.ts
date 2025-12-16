/**
 * @fileoverview Unit tests for RAGFlow configuration service.
 * Tests config loading from various sources, getter methods,
 * and configuration reload functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

// Mock logger to avoid console noise
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock config
vi.mock('../../src/config/index.js', () => ({
    config: {
        ragflowConfigPath: undefined,
    },
}));

describe('RagflowService', () => {
    const mockConfig = {
        aiChatUrl: 'https://ragflow.example.com/chat',
        aiSearchUrl: 'https://ragflow.example.com/search',
        chatSources: [
            { id: 'chat1', name: 'Chat Source 1', url: 'https://chat1.example.com' },
            { id: 'chat2', name: 'Chat Source 2', url: 'https://chat2.example.com' },
        ],
        searchSources: [
            { id: 'search1', name: 'Search Source 1', url: 'https://search1.example.com' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module cache to get fresh service instance
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Config Loading', () => {
        it('should load config from environment variable path first', async () => {
            const envPath = '/custom/path/ragflow.config.json';
            
            // Mock config with env path
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: envPath,
                },
            }));

            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return p === envPath;
            });
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            // Import service fresh
            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            expect(ragflowService.getAiChatUrl()).toBe(mockConfig.aiChatUrl);
            expect(ragflowService.getAiSearchUrl()).toBe(mockConfig.aiSearchUrl);
        });

        it('should load config from Docker volume path if env path not available', async () => {
            const dockerPath = '/app/config/ragflow.config.json';

            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return p === dockerPath;
            });
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            expect(ragflowService.getAiChatUrl()).toBe(mockConfig.aiChatUrl);
        });

        it('should handle missing config file gracefully', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(false);

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            // Should return empty defaults
            expect(ragflowService.getAiChatUrl()).toBe('');
            expect(ragflowService.getAiSearchUrl()).toBe('');
            expect(ragflowService.getChatSources()).toEqual([]);
            expect(ragflowService.getSearchSources()).toEqual([]);
        });

        it('should handle invalid JSON gracefully', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            // Should return empty defaults on parse error
            expect(ragflowService.getAiChatUrl()).toBe('');
        });

        it('should initialize empty arrays for missing sources in config', async () => {
            const partialConfig = {
                aiChatUrl: 'https://chat.example.com',
                aiSearchUrl: 'https://search.example.com',
                // Missing chatSources and searchSources
            };

            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(partialConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            expect(ragflowService.getChatSources()).toEqual([]);
            expect(ragflowService.getSearchSources()).toEqual([]);
        });
    });

    describe('getConfig', () => {
        it('should return the full configuration object', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');
            const config = ragflowService.getConfig();

            expect(config).toHaveProperty('aiChatUrl', mockConfig.aiChatUrl);
            expect(config).toHaveProperty('aiSearchUrl', mockConfig.aiSearchUrl);
            expect(config).toHaveProperty('chatSources');
            expect(config).toHaveProperty('searchSources');
        });
    });

    describe('getAiChatUrl', () => {
        it('should return the AI Chat URL', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            expect(ragflowService.getAiChatUrl()).toBe(mockConfig.aiChatUrl);
        });
    });

    describe('getAiSearchUrl', () => {
        it('should return the AI Search URL', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            expect(ragflowService.getAiSearchUrl()).toBe(mockConfig.aiSearchUrl);
        });
    });

    describe('getChatSources', () => {
        it('should return all chat sources', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');
            const sources = ragflowService.getChatSources();

            expect(sources).toHaveLength(2);
            expect(sources[0]).toEqual(mockConfig.chatSources[0]);
            expect(sources[1]).toEqual(mockConfig.chatSources[1]);
        });
    });

    describe('getSearchSources', () => {
        it('should return all search sources', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');
            const sources = ragflowService.getSearchSources();

            expect(sources).toHaveLength(1);
            expect(sources[0]).toEqual(mockConfig.searchSources[0]);
        });
    });

    describe('reload', () => {
        it('should reload configuration from file', async () => {
            vi.doMock('../../src/config/index.js', () => ({
                config: {
                    ragflowConfigPath: undefined,
                },
            }));

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const { ragflowService } = await import('../../src/services/ragflow.service.js');

            // Initial load
            expect(ragflowService.getAiChatUrl()).toBe(mockConfig.aiChatUrl);

            // Update mock to return new config
            const updatedConfig = {
                ...mockConfig,
                aiChatUrl: 'https://new-chat.example.com',
            };
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(updatedConfig));

            // Reload and verify
            ragflowService.reload();

            expect(ragflowService.getAiChatUrl()).toBe(updatedConfig.aiChatUrl);
        });
    });
});
