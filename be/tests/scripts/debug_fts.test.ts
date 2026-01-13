import { afterEach, describe, expect, it, vi } from 'vitest'

describe('debug_fts script', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('runs FTS checks and handles no record gracefully', async () => {
    // Provide a static mocked db function
    vi.mock('../../src/db/knex', () => ({
      db: Object.assign(
        // callable function that behaves like a query builder
        ((..._args: any[]) => ({ where: () => ({ orWhere: () => ({ first: async () => undefined }) }), raw: async () => ({ rows: [{ q: 'q' }] }), whereRaw: () => ({ count: async () => [{ count: 0 }] }), insert: async () => {}, del: async () => {} })),
        { destroy: async () => {} }
      )
    }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('../../src/scripts/debug_fts')

    expect(log).toHaveBeenCalled()
  })
})