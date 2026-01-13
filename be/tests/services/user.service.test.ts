/**
 * @fileoverview Unit tests for UserService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

const mockAudit = vi.hoisted(() => ({
  log: vi.fn(),
}))

vi.mock('../../src/services/audit.service.js', () => ({
  auditService: mockAudit,
  AuditAction: {
    CREATE_USER: 'CREATE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',
  },
  AuditResourceType: {
    USER: 'USER',
  },
}))

const mockUserModel = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const mockUserIpHistory = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByUserAndIp: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}))

vi.mock('../../src/models/factory.js', () => ({
  ModelFactory: {
    user: mockUserModel,
    userIpHistory: mockUserIpHistory,
  },
}))

vi.mock('../../src/config/index.js', () => ({
  config: {
    rootUser: 'admin@localhost',
    rootPassword: 'admin',
    enableRootLogin: true,
  },
}))

import { UserService } from '../../src/services/user.service.js'

const service = new UserService()

const resetMocks = () => {
  vi.clearAllMocks()
  mockUserModel.findAll.mockReset()
  mockUserModel.findById.mockReset()
  mockUserModel.findByEmail.mockReset()
  mockUserModel.create.mockReset()
  mockUserModel.update.mockReset()
  mockUserModel.delete.mockReset()
  mockUserIpHistory.findAll.mockReset()
  mockUserIpHistory.findByUserAndIp.mockReset()
  mockUserIpHistory.update.mockReset()
  mockUserIpHistory.create.mockReset()
  mockAudit.log.mockReset()
}

describe('UserService', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('initializeRootUser', () => {
    it('skips creation when users exist', async () => {
      mockUserModel.findAll.mockResolvedValueOnce([{}])

      await service.initializeRootUser()

      expect(mockUserModel.create).not.toHaveBeenCalled()
    })

    it('creates root user when none exist', async () => {
      mockUserModel.findAll.mockResolvedValueOnce([])
      mockUserModel.create.mockResolvedValueOnce({ id: 'root-user' })

      await service.initializeRootUser()

      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'root-user',
        email: 'admin@localhost',
        role: 'admin',
      }))
    })

    it('logs error but does not throw on failure', async () => {
      mockUserModel.findAll.mockRejectedValueOnce(new Error('db'))

      await expect(service.initializeRootUser()).resolves.not.toThrow()
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  describe('findOrCreateUser', () => {
    const adUser = {
      id: 'azure-id',
      email: 'user@example.com',
      displayName: 'User Example',
      department: 'IT',
      jobTitle: 'Engineer',
      mobilePhone: '+1',
    }

    it('returns existing user without update when unchanged', async () => {
      const existing = {
        id: 'azure-id',
        email: 'user@example.com',
        display_name: 'User Example',
        role: 'user',
        permissions: '[]',
        department: 'IT',
        job_title: 'Engineer',
        mobile_phone: '+1',
      }
      mockUserModel.findById.mockResolvedValueOnce(existing)

      const result = await service.findOrCreateUser(adUser)

      expect(result).toBe(existing)
      expect(mockUserModel.update).not.toHaveBeenCalled()
    })

    it('updates changed fields and logs audit', async () => {
      const existing = {
        id: 'azure-id',
        email: 'old@example.com',
        display_name: 'Old',
        role: 'user',
        permissions: '[]',
        department: 'OldDept',
        job_title: 'OldTitle',
        mobile_phone: '000',
      }
      mockUserModel.findById.mockResolvedValueOnce(existing)
      mockUserModel.update.mockResolvedValueOnce({ ...existing, email: 'user@example.com' })

      const result = await service.findOrCreateUser(adUser, '1.1.1.1')

      expect(mockUserModel.update).toHaveBeenCalled()
      expect(mockAudit.log).toHaveBeenCalled()
      expect(result.email).toBe('user@example.com')
    })

    it('creates new user when none found and audits', async () => {
      mockUserModel.findById.mockResolvedValueOnce(undefined)
      mockUserModel.findByEmail.mockResolvedValueOnce(undefined)
      mockUserModel.create.mockResolvedValueOnce({ id: 'azure-id', email: 'user@example.com', role: 'user' })

      const result = await service.findOrCreateUser(adUser)

      expect(mockUserModel.create).toHaveBeenCalled()
      expect(mockAudit.log).toHaveBeenCalled()
      expect(result.id).toBe('azure-id')
    })

    it('propagates errors and logs', async () => {
      mockUserModel.findById.mockRejectedValueOnce(new Error('fail'))

      await expect(service.findOrCreateUser(adUser)).rejects.toThrow('fail')
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  describe('getAllUsers', () => {
    it('filters by roles and sorts desc', async () => {
      const now = new Date()
      const earlier = new Date(now.getTime() - 1000)
      mockUserModel.findAll.mockResolvedValueOnce([
        { id: 'b', role: 'user', created_at: earlier },
        { id: 'a', role: 'admin', created_at: now },
      ])

      const result = await service.getAllUsers(['admin'])

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('a')
    })
  })

  describe('create/update/delete users', () => {
    it('creates user and audits when actor provided', async () => {
      mockUserModel.create.mockResolvedValueOnce({ id: 'new' })

      const actor = { id: 'admin', email: 'a@a.com', ip: '1.1.1.1' }
      await service.createUser({ email: 'x' }, actor)

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'new' }))
    })

    it('updates user and audits when actor provided', async () => {
      mockUserModel.update.mockResolvedValueOnce({ id: 'u1' })

      await service.updateUser('u1', { role: 'admin' }, { id: 'admin', email: 'a@a.com' })

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'u1' }))
    })

    it('deletes user and audits when actor provided', async () => {
      await service.deleteUser('u1', { id: 'admin', email: 'a@a.com' })

      expect(mockUserModel.delete).toHaveBeenCalledWith('u1')
      expect(mockAudit.log).toHaveBeenCalled()
    })

    it('updates permissions and audits', async () => {
      await service.updateUserPermissions('u1', ['p1', 'p2'], { id: 'admin', email: 'a@a.com' })

      expect(mockUserModel.update).toHaveBeenCalledWith('u1', { permissions: JSON.stringify(['p1', 'p2']), updated_by: 'admin' })
      expect(mockAudit.log).toHaveBeenCalled()
    })
  })

  describe('recordUserIp', () => {
    it('skips unknown IPs', async () => {
      await service.recordUserIp('u1', 'unknown')
      expect(mockUserIpHistory.create).not.toHaveBeenCalled()
    })

    it('updates existing when stale', async () => {
      const old = new Date(Date.now() - 120000)
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce({ id: 'h1', last_accessed_at: old })

      await service.recordUserIp('u1', '1.1.1.1')

      expect(mockUserIpHistory.update).toHaveBeenCalled()
    })

    it('creates when none exists', async () => {
      mockUserIpHistory.findByUserAndIp.mockResolvedValueOnce(undefined)

      await service.recordUserIp('u1', '2.2.2.2')

      expect(mockUserIpHistory.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }))
    })
  })

  describe('getUserIpHistory', () => {
    it('sorts history descending', async () => {
      const recent = { last_accessed_at: new Date('2024-02-02'), user_id: 'u1' }
      const old = { last_accessed_at: new Date('2024-01-01'), user_id: 'u1' }
      mockUserIpHistory.findAll.mockResolvedValueOnce([recent, old])

      const result = await service.getUserIpHistory('u1')

      expect(result[0]).toBe(recent)
      expect(result[1]).toBe(old)
    })
  })

  describe('getAllUsersIpHistory', () => {
    it('aggregates histories by user', async () => {
      const entries = [
        { user_id: 'a', last_accessed_at: new Date('2024-01-02') },
        { user_id: 'a', last_accessed_at: new Date('2024-01-01') },
        { user_id: 'b', last_accessed_at: new Date('2024-01-03') },
      ]
      mockUserIpHistory.findAll.mockResolvedValueOnce(entries as any)

      const map = await service.getAllUsersIpHistory()

      expect(map.get('a')?.length).toBe(2)
      expect(map.get('b')?.length).toBe(1)
    })
  })

  describe('duplicate email and role update validations', () => {
    it('createUser throws when email exists', async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce({ id: 'u1' })
      await expect(service.createUser({ email: 'x' })).rejects.toThrow(/already exists/)
    })

    it('updateUser throws when email exists on another user', async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce({ id: 'u2' })
      await expect(service.updateUser('u1', { email: 'x' })).rejects.toThrow(/already exists/)
    })

    it('updateUserRole rejects invalid id and role and prevents self-modification and unauthorized promotion', async () => {
      // invalid id
      await expect(service.updateUserRole('not-uuid', 'user', { id: 'a', role: 'admin', email: 'a@a' })).rejects.toThrow('Invalid user ID format')

      // invalid role
      await expect(service.updateUserRole('11111111-2222-3333-4444-555555555555', 'bogus' as any, { id: 'a', role: 'admin', email: 'a@a' })).rejects.toThrow('Invalid role')

      // self modification should be tested with valid uuid
      const actor = { id: '11111111-2222-3333-4444-555555555555', role: 'admin', email: 'a@a' }
      await expect(service.updateUserRole('11111111-2222-3333-4444-555555555555', 'admin', actor as any)).rejects.toThrow('Cannot modify your own role')
      expect(mockLog.warn).toHaveBeenCalled()

      // non-admin promoting to admin
      const actor2 = { id: 'id2', role: 'leader', email: 'b@b' }
      await expect(service.updateUserRole('11111111-2222-3333-4444-555555555555', 'admin', actor2 as any)).rejects.toThrow('Only administrators can grant admin role')
      expect(mockLog.warn).toHaveBeenCalled()
    })

    it('updateUserRole succeeds and logs when valid', async () => {
      const uid = '11111111-2222-3333-4444-555555555555'
      const actor = { id: 'admin1', role: 'admin', email: 'a@a', ip: '1.2.3.4' }
      mockUserModel.update.mockResolvedValueOnce({ id: uid, email: 't@e' })

      const res = await service.updateUserRole(uid, 'leader', actor as any)
      expect(res).toEqual({ id: uid, email: 't@e' })
      expect(mockAudit.log).toHaveBeenCalled()
    })
  })
})
