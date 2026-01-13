import { afterEach, describe, expect, it, vi } from 'vitest'

describe('debug_feedback script', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('handles no prompts and exits gracefully', async () => {
    // Static promptService mock
    vi.mock('../../src/services/prompt.service', () => ({
      promptService: {
        getPrompts: async () => ({ data: [], total: 0 }),
        getInteractionsForPrompt: async () => []
      }
    }))

    vi.mock('../../src/db/knex', () => ({
      db: Object.assign(((..._args: any[]) => ({ where: () => ({ count: async () => [{ c: 0 }], first: async () => ({ c: 0 }) }) })), { destroy: async () => {} })
    }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('../../src/scripts/debug_feedback')

    // The script logs progress; ensure logs were produced
    expect(log).toHaveBeenCalled()
  })
})