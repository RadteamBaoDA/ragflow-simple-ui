import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

describe('migrate script', () => {
  beforeEach(() => {
    // Mock process.exit to throw so import stops and we can assert the code
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => { throw new Error(`process.exit:${code}`) })
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('calls db.migrate.latest and exits 0 on success', async () => {
    process.env.MIGRATE_BEHAVIOR = 'ok'

    vi.mock('knex', () => ({
      default: () => ({
        migrate: { latest: async () => { if (process.env.MIGRATE_BEHAVIOR === 'fail') throw new Error('boom') } },
        destroy: async () => {}
      })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../src/scripts/migrate')
    const code = await exitCalled
    expect(code).toBe(0)
    delete process.env.MIGRATE_BEHAVIOR
  })

  it('exits 1 when migrate.latest throws', async () => {
    process.env.MIGRATE_BEHAVIOR = 'fail'

    vi.mock('knex', () => ({
      default: () => ({
        migrate: { latest: async () => { if (process.env.MIGRATE_BEHAVIOR === 'fail') throw new Error('boom') } },
        destroy: async () => {}
      })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../src/scripts/migrate')
    const code = await exitCalled
    expect(code).toBe(1)
    delete process.env.MIGRATE_BEHAVIOR
  })
})