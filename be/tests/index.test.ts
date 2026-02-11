import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('entry point index.ts', () => {
  beforeEach(() => {
    // ensure test mode to avoid server start attempts
    process.env.VITEST = '1'
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    delete process.env.VITEST
  })

  it.skip('imports without starting server and sets up routes', async () => {
    const initRedis = vi.fn().mockResolvedValue(undefined)
    const getRedisClient = vi.fn().mockReturnValue({})
    const setupApiRoutes = vi.fn()

    vi.mock('../../src/shared/services/redis.service', () => ({ initRedis, getRedisClient, shutdownRedis: vi.fn() }))
    vi.mock('../../src/app/routes', () => ({ setupApiRoutes }))
    vi.mock('../../src/shared/services/cron.service', () => ({ cronService: { startCleanupJob: vi.fn() } }))
    vi.mock('../../src/modules/knowledge-base/knowledge-base.service', () => ({ knowledgeBaseService: { initialize: vi.fn() } }))
    vi.mock('../../src/modules/system-tools/system-tools.service', () => ({ systemToolsService: { initialize: vi.fn() } }))

    const mod = await import('../../src/index')

    expect(mod.app).toBeDefined()
    expect(setupApiRoutes).toHaveBeenCalled()
  })
})