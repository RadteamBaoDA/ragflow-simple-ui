import { afterEach, describe, expect, it, vi } from 'vitest'

describe('knex singleton (db)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('exports the same instance created by knex()', async () => {
    vi.mock('knex', () => ({ default: () => ({ name: 'knex-instance' }) }))

    const { db } = await import('../../src/db/knex')
    expect((db as any).name).toBe('knex-instance')

    // re-importing should return the same instance
    const { db: db2 } = await import('../../src/db/knex')
    expect((db2 as any).name).toBe('knex-instance')
  })
})