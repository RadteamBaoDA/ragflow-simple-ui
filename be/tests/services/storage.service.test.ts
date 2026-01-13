import { afterEach, describe, expect, it, vi } from 'vitest'

describe('storage.service', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    delete process.env.STORAGE_PROVIDER
  })

  it('defaults to Minio provider when not configured', async () => {
    vi.mock('../../src/services/storage/providers/minio.provider', () => ({
      MinioStorageProvider: class { constructor() { (this as any).__isMinio = true } }
    }))

    const mod = await import('../../src/services/storage/storage.service')
    const { getMinioProvider } = mod
    expect(getMinioProvider().__isMinio).toBe(true)
  })

  it('falls back when unknown provider is set', async () => {
    process.env.STORAGE_PROVIDER = 'unknown'
    vi.mock('../../src/services/storage/providers/minio.provider', () => ({
      MinioStorageProvider: class { constructor() { (this as any).__isMinio = true } }
    }))

    const mod = await import('../../src/services/storage/storage.service')
    const { getMinioProvider } = mod
    expect(getMinioProvider().__isMinio).toBe(true)
  })

  it('getMinioProvider returns provider instance', async () => {
    vi.mock('../../src/services/storage/providers/minio.provider', () => ({
      MinioStorageProvider: class { constructor() { (this as any).__isMinio = true } }
    }))

    const mod = await import('../../src/services/storage/storage.service')
    const { getMinioProvider } = mod
    expect(getMinioProvider().__isMinio).toBe(true)
  })

  it('azure and gcp providers log warning and fall back', async () => {
    process.env.STORAGE_PROVIDER = 'azure'
    vi.mock('../../src/services/logger.service.js', () => ({ log: { warn: vi.fn(), info: vi.fn() } }))
    vi.mock('../../src/services/storage/providers/minio.provider', () => ({ MinioStorageProvider: class { constructor() { (this as any).__isMinio = true } } }))
    const modAzure = await import('../../src/services/storage/storage.service')
    expect((await import('../../src/services/logger.service.js')).log.warn).toHaveBeenCalled()

    vi.resetModules()
    process.env.STORAGE_PROVIDER = 'gcp'
    vi.mock('../../src/services/logger.service.js', () => ({ log: { warn: vi.fn(), info: vi.fn() } }))
    vi.mock('../../src/services/storage/providers/minio.provider', () => ({ MinioStorageProvider: class { constructor() { (this as any).__isMinio = true } } }))
    const modGcp = await import('../../src/services/storage/storage.service')
    expect((await import('../../src/services/logger.service.js')).log.warn).toHaveBeenCalled()
  })
})