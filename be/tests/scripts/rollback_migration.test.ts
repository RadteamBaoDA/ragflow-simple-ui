import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

describe('rollback_migration script', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => { throw new Error(`process.exit:${code}`) })
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('calls db.migrate.rollback and exits 0 on success', async () => {
    process.env.ROLLBACK_BEHAVIOR = 'ok'

    vi.mock('knex', () => ({
      default: () => ({ migrate: { rollback: async () => { if (process.env.ROLLBACK_BEHAVIOR === 'fail') throw new Error('boom') } }, destroy: async () => {} })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../src/scripts/rollback_migration')
    const code = await exitCalled
    expect(code).toBe(0)
    delete process.env.ROLLBACK_BEHAVIOR
  })

  it('exits 1 when rollback throws', async () => {
    process.env.ROLLBACK_BEHAVIOR = 'fail'

    vi.mock('knex', () => ({
      default: () => ({ migrate: { rollback: async () => { if (process.env.ROLLBACK_BEHAVIOR === 'fail') throw new Error('boom') } }, destroy: async () => {} })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../src/scripts/rollback_migration')
    const code = await exitCalled
    expect(code).toBe(1)
    delete process.env.ROLLBACK_BEHAVIOR
  })
})