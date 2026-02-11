/**
 * @fileoverview Tests for UserModel helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserModel } from '../../src/modules/users/user.model.js'

const makeBuilder = (rows: any[] = []) => {
  const builder: any = {
    where: vi.fn(() => builder),
    first: vi.fn(() => Promise.resolve(rows[0])),
  }
  return builder
}

describe('UserModel', () => {
  let model: UserModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[]) => {
    builder = makeBuilder(rows)
    mockKnex = vi.fn(() => builder)
    model = new UserModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup([])
  })

  it('findByEmail queries by email and returns user', async () => {
    const row = { id: 'u1', email: 'a@example.com' }
    setup([row])

    const result = await model.findByEmail('a@example.com')

    expect(mockKnex).toHaveBeenCalledWith('users')
    expect(builder.where).toHaveBeenCalledWith({ email: 'a@example.com' })
    expect(builder.first).toHaveBeenCalled()
    expect(result).toEqual(row)
  })
})
