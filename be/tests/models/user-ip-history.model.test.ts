/**
 * @fileoverview Tests for UserIpHistoryModel helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserIpHistoryModel } from '../../src/modules/users/user-ip-history.model.js'

const makeBuilder = (rows: any[] = []) => {
  const builder: any = {
    where: vi.fn(() => builder),
    first: vi.fn(() => Promise.resolve(rows[0])),
  }
  return builder
}

describe('UserIpHistoryModel', () => {
  let model: UserIpHistoryModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder)
    model = new UserIpHistoryModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup([])
  })

  it('findByUserAndIp queries with composite filter', async () => {
    const row = { user_id: 'u1', ip_address: '1.1.1.1' }
    setup([row])

    const result = await model.findByUserAndIp('u1', '1.1.1.1')

    expect(mockKnex).toHaveBeenCalledWith('user_ip_history')
    expect(builder.where).toHaveBeenCalledWith({ user_id: 'u1', ip_address: '1.1.1.1' })
    expect(result).toEqual(row)
  })
})
