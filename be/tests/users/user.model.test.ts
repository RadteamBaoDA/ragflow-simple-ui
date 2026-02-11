/**
 * @fileoverview Unit tests for User and UserIPHistory Models.
 * Verifies basic lookup queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserModel } from '../../src/modules/users/user.model.js'
import { UserIpHistoryModel } from '../../src/modules/users/user-ip-history.model.js'
import { db } from '../../src/shared/db/knex.js'

vi.mock('../../src/shared/db/knex.js', () => ({
  db: vi.fn(),
}))

describe('User Models', () => {
  let mockQuery: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(db).mockReturnValue(mockQuery as any)
  })

  describe('UserModel', () => {
    it('findByEmail queries correctly', async () => {
      const model = new UserModel()
      await model.findByEmail('test@test.com')
      expect(db).toHaveBeenCalledWith('users')
      expect(mockQuery.where).toHaveBeenCalledWith({ email: 'test@test.com' })
      expect(mockQuery.first).toHaveBeenCalled()
    })
  })

  describe('UserIpHistoryModel', () => {
    it('findByUserAndIp queries correctly', async () => {
      const model = new UserIpHistoryModel()
      await model.findByUserAndIp('u1', '1.2.3.4')
      expect(db).toHaveBeenCalledWith('user_ip_history')
      expect(mockQuery.where).toHaveBeenCalledWith({ user_id: 'u1', ip_address: '1.2.3.4' })
    })
  })
})
