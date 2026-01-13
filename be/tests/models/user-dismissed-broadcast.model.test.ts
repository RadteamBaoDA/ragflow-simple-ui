/**
 * @fileoverview Tests for UserDismissedBroadcastModel upsert helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserDismissedBroadcastModel } from '../../src/models/user-dismissed-broadcast.model.js'

const makeBuilder = () => {
  const builder: any = {
    insert: vi.fn(() => builder),
    onConflict: vi.fn(() => ({ ignore: vi.fn(() => Promise.resolve()) })),
  }
  return builder
}

describe('UserDismissedBroadcastModel', () => {
  let model: UserDismissedBroadcastModel
  let builder: any
  let mockKnex: any

  const setup = () => {
    builder = makeBuilder()
    mockKnex = vi.fn(() => builder)
    model = new UserDismissedBroadcastModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup()
  })

  it('upsertDismissal inserts and ignores conflicts', async () => {
    await model.upsertDismissal('u1', 'b1')

    expect(mockKnex).toHaveBeenCalledWith('user_dismissed_broadcasts')
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', broadcast_id: 'b1', created_by: 'u1', updated_by: 'u1' })
    expect(builder.onConflict).toHaveBeenCalledWith(['user_id', 'broadcast_id'])
  })
})
