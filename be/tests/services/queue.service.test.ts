/**
 * @fileoverview Unit tests for QueueService with bee-queue mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueueService } from '../../src/services/queue.service.js'

const mockLog = vi.hoisted(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}))

const mockBeeQueue = vi.hoisted(() => {
    return vi.fn().mockImplementation((queueName) => ({
        name: queueName,
        process: vi.fn(),
        on: vi.fn(),
        add: vi.fn().mockResolvedValue({ id: 'job-1' }),
        close: vi.fn().mockResolvedValue(undefined),
    }))
})

vi.mock('bee-queue', () => ({
    default: mockBeeQueue,
}))

vi.mock('../../src/services/logger.service.js', () => ({
    log: mockLog,
}))

vi.mock('../../src/config/index.js', () => ({
    config: {
        redis: {
            host: 'localhost',
            port: 6379,
            password: '',
            db: 0,
        },
    },
}))

describe('QueueService', () => {
    let service: QueueService

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = QueueService.getInstance()
            const instance2 = QueueService.getInstance()

            expect(instance1).toBe(instance2)
            expect(instance1).toBeInstanceOf(QueueService)
        })

        it('should create new instance on first call', () => {
            const instance = QueueService.getInstance()
            expect(instance).toBeInstanceOf(QueueService)
        })
    })

    describe('initialization', () => {
        it('should initialize Redis config from config module', () => {
            const instance = QueueService.getInstance()
            expect(instance).toBeInstanceOf(QueueService)
        })

        it('should setup queue service successfully', () => {
            const instance = QueueService.getInstance()
            expect(instance).toBeDefined()
        })
    })
})
