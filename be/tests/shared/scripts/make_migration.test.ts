import { afterEach, describe, expect, it, vi } from 'vitest'

describe('make_migration script', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    delete process.argv[2]
  })

  it('exits 1 if name missing', async () => {
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => { throw new Error(`process.exit:${code}`) })
    // no name in argv
    delete process.argv[2]

    vi.mock('knex', () => ({ default: () => ({ migrate: { make: async (name: string) => { if (process.env.MIGRATION_BEHAVIOR === 'fail') throw new Error('fail'); return process.env.MIGRATION_RESULT || 'file.ts' } }, destroy: async () => {} }) }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../../src/scripts/make_migration')
    const code = await exitCalled
    expect(code).toBe(1)
  })

  it('creates migration and exits 0 when name provided', async () => {
    process.argv[2] = 'add_users'
    process.env.MIGRATION_BEHAVIOR = 'ok'

    vi.spyOn(process, 'exit').mockImplementation((code?: number) => { throw new Error(`process.exit:${code}`) })

    vi.mock('knex', () => ({ default: () => ({ migrate: { make: async (name: string) => { if (process.env.MIGRATION_BEHAVIOR === 'fail') throw new Error('fail'); return 'file.ts' } }, destroy: async () => {} }) }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../../src/scripts/make_migration')
    const code = await exitCalled
    expect(code).toBe(0)
    delete process.env.MIGRATION_BEHAVIOR
    delete process.argv[2]
  })
})