import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

describe('run_seeds script', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => { throw new Error(`process.exit:${code}`) })
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('runs seeds and exits 0 on success', async () => {
    process.env.SEED_BEHAVIOR = 'ok'

    vi.mock('knex', () => ({
      default: () => ({
        seed: { run: async () => { if (process.env.SEED_BEHAVIOR === 'fail') throw new Error('fail') } },
        destroy: async () => {}
      })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../../src/scripts/run_seeds')
    const code = await exitCalled
    expect(code).toBe(0)
    delete process.env.SEED_BEHAVIOR
  })

  it('exits 1 when seed.run throws', async () => {
    process.env.SEED_BEHAVIOR = 'fail'

    vi.mock('knex', () => ({
      default: () => ({
        seed: { run: async () => { if (process.env.SEED_BEHAVIOR === 'fail') throw new Error('fail') } },
        destroy: async () => {}
      })
    }))

    const exitCalled = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code?: number) => { resolve(code ?? 0); return undefined as never })
    })

    await import('../../../src/scripts/run_seeds')
    const code = await exitCalled
    expect(code).toBe(1)
    delete process.env.SEED_BEHAVIOR
  })
})