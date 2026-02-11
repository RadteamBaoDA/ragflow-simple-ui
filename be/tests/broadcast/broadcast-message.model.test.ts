/**
 * @fileoverview Tests for BroadcastMessageModel.
 * 
 * Tests custom query methods for finding active messages with dismissal filtering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BroadcastMessageModel } from '../../src/modules/broadcast/broadcast-message.model.js'

// Mock Knex query builder with proper chaining
const makeBuilder = (rows: any[] = []) => {
  const builder: any = {
    where: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    select: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    on: vi.fn(() => builder),
    andOn: vi.fn(() => builder),
    whereNull: vi.fn(() => builder),
    orWhereRaw: vi.fn(() => builder),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
  }
  return builder
}

describe('BroadcastMessageModel', () => {
  let model: BroadcastMessageModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder) as any
    mockKnex.raw = vi.fn((sql: string, bindings?: any[]) => ({ sql, bindings }))
    model = new BroadcastMessageModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findActive', () => {
    it('should return active messages within time range using Date object', async () => {
      const now = new Date('2024-01-15T12:00:00Z')
      const activeMessages = [
        { id: 'msg1', message: 'Message 1', is_active: true, starts_at: '2024-01-01', ends_at: '2024-12-31' },
        { id: 'msg2', message: 'Message 2', is_active: true, starts_at: '2024-01-10', ends_at: '2024-01-20' }
      ]
      setup(activeMessages)

      const result = await model.findActive(now)

      expect(mockKnex).toHaveBeenCalledWith('broadcast_messages')
      expect(builder.where).toHaveBeenCalledWith('is_active', true)
      expect(builder.where).toHaveBeenCalledWith('starts_at', '<=', now.toISOString())
      expect(builder.where).toHaveBeenCalledWith('ends_at', '>=', now.toISOString())
      expect(builder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
      expect(result).toEqual(activeMessages)
    })

    it('should return active messages using string timestamp', async () => {
      const timestamp = '2024-01-15T12:00:00Z'
      const activeMessages = [{ id: 'msg1', message: 'Active', is_active: true }]
      setup(activeMessages)

      const result = await model.findActive(timestamp)

      expect(builder.where).toHaveBeenCalledWith('starts_at', '<=', timestamp)
      expect(builder.where).toHaveBeenCalledWith('ends_at', '>=', timestamp)
      expect(result).toEqual(activeMessages)
    })

    it('should use current date when no parameter provided', async () => {
      setup([])
      
      await model.findActive()

      expect(mockKnex).toHaveBeenCalledWith('broadcast_messages')
      expect(builder.where).toHaveBeenCalledWith('is_active', true)
      expect(builder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    })

    it('should return empty array when no active messages', async () => {
      setup([])

      const result = await model.findActive()

      expect(result).toEqual([])
    })

    it('should filter by active status and date range', async () => {
      const now = '2024-01-15T12:00:00Z'
      setup([])

      await model.findActive(now)

      // Verify all three where clauses are called
      expect(builder.where).toHaveBeenCalledTimes(3)
      expect(builder.where).toHaveBeenNthCalledWith(1, 'is_active', true)
      expect(builder.where).toHaveBeenNthCalledWith(2, 'starts_at', '<=', now)
      expect(builder.where).toHaveBeenNthCalledWith(3, 'ends_at', '>=', now)
    })
  })

  describe('findActiveExcludingDismissed', () => {
    it('should return active messages excluding user dismissals using Date', async () => {
      const userId = 'user123'
      const now = new Date('2024-01-15T12:00:00Z')
      const messages = [{ id: 'msg1', message: 'Not dismissed', is_active: true }]
      setup(messages)

      const result = await model.findActiveExcludingDismissed(userId, now)

      expect(mockKnex).toHaveBeenCalledWith('broadcast_messages')
      expect(builder.select).toHaveBeenCalledWith('broadcast_messages.*')
      expect(builder.leftJoin).toHaveBeenCalledWith('user_dismissed_broadcasts as d', expect.any(Function))
      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.is_active', true)
      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.starts_at', '<=', now.toISOString())
      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.ends_at', '>=', now.toISOString())
      expect(builder.where).toHaveBeenCalledWith(expect.any(Function))
      expect(builder.orderBy).toHaveBeenCalledWith('broadcast_messages.created_at', 'desc')
      // mockKnex.raw is called inside the leftJoin callback function
      expect(result).toEqual(messages)
    })

    it('should return active messages excluding dismissals using string timestamp', async () => {
      const userId = 'user456'
      const timestamp = '2024-01-15T12:00:00Z'
      const messages = [{ id: 'msg2', message: 'Available', is_active: true }]
      setup(messages)

      const result = await model.findActiveExcludingDismissed(userId, timestamp)

      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.starts_at', '<=', timestamp)
      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.ends_at', '>=', timestamp)
      expect(result).toEqual(messages)
    })

    it('should use current date when no timestamp provided', async () => {
      const userId = 'user789'
      setup([])

      await model.findActiveExcludingDismissed(userId)

      expect(mockKnex).toHaveBeenCalledWith('broadcast_messages')
      expect(builder.select).toHaveBeenCalledWith('broadcast_messages.*')
      expect(builder.where).toHaveBeenCalledWith('broadcast_messages.is_active', true)
    })

    it('should filter dismissed messages with LEFT JOIN', async () => {
      const userId = 'user999'
      const timestamp = '2024-01-15T12:00:00Z'
      setup([])

      await model.findActiveExcludingDismissed(userId, timestamp)

      // Verify LEFT JOIN setup
      expect(builder.leftJoin).toHaveBeenCalledWith('user_dismissed_broadcasts as d', expect.any(Function))
      // mockKnex.raw is called inside the leftJoin callback function
    })

    it('should include messages with expired dismissals (>24h)', async () => {
      const userId = 'user111'
      const messages = [{ id: 'msg3', message: 'Dismissal expired', is_active: true }]
      setup(messages)

      await model.findActiveExcludingDismissed(userId)

      // The orWhereRaw should be called for the 24-hour check
      expect(builder.where).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should return empty array when all messages dismissed', async () => {
      const userId = 'user222'
      setup([])

      const result = await model.findActiveExcludingDismissed(userId)

      expect(result).toEqual([])
    })
  })

  describe('tableName', () => {
    it('should use broadcast_messages table', () => {
      setup([])
      expect((model as any).tableName).toBe('broadcast_messages')
    })
  })
})
