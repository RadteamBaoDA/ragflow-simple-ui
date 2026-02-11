/**
 * @fileoverview Unit tests for UserService.
 * Mocks dependencies to verify user synchronization, security checks, and audit logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks
const { mockUser, mockUserIpHistory, mockAudit, mockLog } = vi.hoisted(() => ({
  mockUser: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockUserIpHistory: {
    findByUserAndIp: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
  },
  mockAudit: {
    log: vi.fn(),
  },
  mockLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/shared/models/factory.js', () => ({
  ModelFactory: {
    user: mockUser,
    userIpHistory: mockUserIpHistory,
  },
}))

vi.mock('@/shared/config/index.js', () => ({
  config: { rootUser: 'root@test.com' },
}))

vi.mock('@/shared/services/logger.service.js', () => ({
  log: mockLog,
}))

vi.mock('@/modules/audit/audit.service.js', () => ({
  auditService: mockAudit,
  AuditAction: {
    CREATE_USER: 'CREATE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',
    UPDATE_ROLE: 'UPDATE_ROLE',
  },
  AuditResourceType: { USER: 'USER' },
}))

import { userService } from '../../src/modules/users/user.service.js'

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initializeRootUser', () => {
    it('creates root user if database is empty', async () => {
      mockUser.findAll.mockResolvedValueOnce([])
      await userService.initializeRootUser()
      expect(mockUser.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'root-user',
        email: 'root@test.com',
        role: 'admin'
      }))
    })

    it('skips initialization if users exist', async () => {
      mockUser.findAll.mockResolvedValueOnce([{ id: '1' }])
      await userService.initializeRootUser()
      expect(mockUser.create).not.toHaveBeenCalled()
    })
  })

  describe('findOrCreateUser', () => {
    const adUser = { id: 'ad-1', email: 'test@test.com', displayName: 'Test', department: 'IT', jobTitle: 'Dev', mobilePhone: '123' }

    it('returns existing user if found by ID', async () => {
      const existing = { 
        id: 'ad-1', 
        email: 'test@test.com', 
        display_name: 'Test',
        department: 'IT',
        job_title: 'Dev',
        mobile_phone: '123'
      }
      mockUser.findById.mockResolvedValueOnce(existing)
      
      const result = await userService.findOrCreateUser(adUser)
      expect(result).toEqual(existing)
      expect(mockUser.create).not.toHaveBeenCalled()
      expect(mockUser.update).not.toHaveBeenCalled()
    })

    it('updates user if profile data changed', async () => {
      const existing = { id: 'ad-1', email: 'test@test.com', display_name: 'Old Name' }
      mockUser.findById.mockResolvedValueOnce(existing)
      mockUser.update.mockResolvedValueOnce({ ...existing, display_name: 'Test' })

      await userService.findOrCreateUser(adUser)
      
      expect(mockUser.update).toHaveBeenCalledWith('ad-1', expect.objectContaining({
        display_name: 'Test'
      }))
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_USER'
      }))
    })

    it('creates new user if not found', async () => {
      mockUser.findById.mockResolvedValueOnce(null)
      mockUser.findByEmail.mockResolvedValueOnce(null)
      mockUser.create.mockResolvedValueOnce({ id: 'ad-1', email: 'test@test.com' })

      await userService.findOrCreateUser(adUser)
      expect(mockUser.create).toHaveBeenCalled()
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_USER'
      }))
    })
  })

  describe('updateUserRole', () => {
    const actor = { id: 'root-user', role: 'admin', email: 'admin@test.com' }
    const targetId = '00000000-0000-0000-0000-000000000001'

    it('successfully updates role', async () => {
      mockUser.update.mockResolvedValueOnce({ id: targetId, email: 't@t.com' })
      await userService.updateUserRole(targetId, 'admin', actor)
      
      expect(mockUser.update).toHaveBeenCalledWith(targetId, { 
        role: 'admin', 
        updated_by: 'root-user' 
      })
    })

    it('throws if trying to modify own role', async () => {
      await expect(userService.updateUserRole('root-user', 'user', actor))
        .rejects.toThrow('Cannot modify your own role')
    })

    it('throws if non-admin tries to promote to admin', async () => {
      const leaderActor = { id: 'l1', role: 'leader', email: 'l@t.com' }
      await expect(userService.updateUserRole(targetId, 'admin', leaderActor))
        .rejects.toThrow('Only administrators can grant admin role')
    })
  })

  describe('recordUserIp', () => {
    it('creates new record if IP never seen for user', async () => {
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce(null)
      await userService.recordUserIp('u1', '1.1.1.1')
      expect(mockUserIpHistory.create).toHaveBeenCalled()
    })

    it('throttles updates if within 60 seconds', async () => {
      const recent = { id: 'h1', last_accessed_at: new Date() }
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce(recent)
      
      await userService.recordUserIp('u1', '1.1.1.1')
      expect(mockUserIpHistory.update).not.toHaveBeenCalled()
    })

    it('updates record if past throttle window', async () => {
      const old = { id: 'h1', last_accessed_at: new Date(Date.now() - 70000) }
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce(old)
      
      await userService.recordUserIp('u1', '1.1.1.1')
      expect(mockUserIpHistory.update).toHaveBeenCalled()
    })
  })
})
