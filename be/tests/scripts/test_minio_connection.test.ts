import { afterEach, describe, expect, it, vi } from 'vitest'

describe('test-minio-connection script', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('logs error and returns when credentials missing', async () => {
    // ensure env has no keys and avoid loading a .env file
    delete process.env.MINIO_ACCESS_KEY
    delete process.env.MINIO_SECRET_KEY
    vi.mock('dotenv', () => ({ default: { config: () => ({}) }, config: () => ({}) }))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../src/scripts/test-minio-connection')

    expect(errorSpy).toHaveBeenCalled()
  })

  it('performs minio flow when credentials present', async () => {
    process.env.MINIO_ACCESS_KEY = 'ak'
    process.env.MINIO_SECRET_KEY = 'sk'

    // Static implementation that returns resolved promises and logs
    vi.mock('minio', () => ({
      Client: class {
        async listBuckets() { return [{ name: 'a' }] }
        async makeBucket() { return undefined }
        async putObject() { return undefined }
        async presignedGetObject() { return 'http://url' }
        async removeObject() { return undefined }
        async removeBucket() { return undefined }
      }
    }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('../../src/scripts/test-minio-connection')

    expect(log).toHaveBeenCalled()
  })
})