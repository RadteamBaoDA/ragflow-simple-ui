/**
 * @fileoverview Tests for AdminController dashboard stats handler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminController } from '../../src/controllers/admin.controller.js'

const mockUserService = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
}))

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../../src/services/user.service.js', () => ({
  userService: mockUserService,
}))

vi.mock('../../src/services/logger.service.js', () => ({
  log: mockLog,
}))

describe('AdminController', () => {
  const controller = new AdminController()
  const makeRes = () => {
    const res: any = {}
    res.status = vi.fn(() => res)
    res.json = vi.fn(() => res)
    return res
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user count in stats', async () => {
    mockUserService.getAllUsers.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }])
    const res = makeRes()

    await controller.getDashboardStats({} as any, res)

    expect(res.json).toHaveBeenCalledWith({ userCount: 2 })
  })

  it('handles errors with 500 and logs', async () => {
    mockUserService.getAllUsers.mockRejectedValueOnce(new Error('boom'))
    const res = makeRes()

    await controller.getDashboardStats({} as any, res)

    expect(mockLog.error).toHaveBeenCalledWith('Failed to fetch dashboard stats', { error: 'Error: boom' })
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch dashboard stats' })
  })
})
