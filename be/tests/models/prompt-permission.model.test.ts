import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptPermissionModel } from '@/models/prompt-permission.model.js'
import { db } from '@/db/knex.js'

vi.mock('@/db/knex.js', () => ({ db: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('PromptPermissionModel', () => {
  it('findByEntity calls knex with where and returns first result', async () => {
    const first = vi.fn().mockResolvedValue({ permission_level: 2 })
    const where = vi.fn(() => ({ first }))
    ;(db as any).mockReturnValue({ where })

    const m = new PromptPermissionModel()
    const res = await m.findByEntity('user', 'u1')

    expect(where).toHaveBeenCalledWith({ entity_type: 'user', entity_id: 'u1' })
    expect(res).toEqual({ permission_level: 2 })
  })
})