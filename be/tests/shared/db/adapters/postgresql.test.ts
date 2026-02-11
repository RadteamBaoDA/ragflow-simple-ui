import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PostgreSQLAdapter } from '../../../../src/shared/db/adapters/postgresql'

// Create a fake PG pool class used by the adapter
class FakePool {
  public on = vi.fn()
  public query = vi.fn()
  public connect = vi.fn()
  public end = vi.fn()
}

// This variable will be set per-test to the fake pool instance the mocked Pool constructor should return
let currentFakePool: any = null

vi.mock('pg', () => ({
  Pool: class {
    constructor() {
      return currentFakePool
    }
  }
}))

describe('PostgreSQLAdapter', () => {
  afterEach(() => {
    currentFakePool = null
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('query returns rows', async () => {
    const { PostgreSQLAdapter } = await import('../../../../src/shared/db/adapters/postgresql')
    const fake = new FakePool()
    fake.query.mockResolvedValue({ rows: [{ id: 1 }] })
    currentFakePool = fake

    const adapter = new PostgreSQLAdapter({ host: 'h', port: 1, database: 'd', user: 'u', password: 'p' })
    const res = await adapter.query('select 1')
    expect(res).toEqual([{ id: 1 }])
  })

  it('queryOne returns first row or undefined', async () => {
    const { PostgreSQLAdapter } = await import('../../../../src/shared/db/adapters/postgresql')
    const fake = new FakePool()
    fake.query.mockResolvedValue({ rows: [{ id: 2 }] })
    currentFakePool = fake

    const adapter = new PostgreSQLAdapter({ host: 'h', port: 1, database: 'd', user: 'u', password: 'p' })
    const r1 = await adapter.queryOne('select')
    expect(r1).toEqual({ id: 2 })

    fake.query.mockResolvedValue({ rows: [] })
    const r2 = await adapter.queryOne('select')
    expect(r2).toBeUndefined()
  })

  it('getClient returns wrapper with query and release', async () => {
    const { PostgreSQLAdapter } = await import('../../../../src/shared/db/adapters/postgresql')
    const fake = new FakePool()
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ x: 1 }] }), release: vi.fn() }
    fake.connect.mockResolvedValue(client)
    currentFakePool = fake

    const adapter = new PostgreSQLAdapter({ host: 'h', port: 1, database: 'd', user: 'u', password: 'p' })
    const wrapper = await adapter.getClient()
    const rows = await wrapper.query('q')
    expect(rows).toEqual([{ x: 1 }])
    wrapper.release()
    expect(client.release).toHaveBeenCalled()
  })

  it('close calls pool.end', async () => {
    const { PostgreSQLAdapter } = await import('../../../../src/shared/db/adapters/postgresql')
    const fake = new FakePool()
    fake.end.mockResolvedValue(undefined)
    currentFakePool = fake

    const adapter = new PostgreSQLAdapter({ host: 'h', port: 1, database: 'd', user: 'u', password: 'p' })
    await adapter.close()
    expect(fake.end).toHaveBeenCalled()
  })

  it('checkConnection true on success and false on failure', async () => {
    const { PostgreSQLAdapter } = await import('../../../../src/shared/db/adapters/postgresql')
    const fake = new FakePool()
    fake.query.mockResolvedValue({ rows: [] })
    currentFakePool = fake

    const adapter = new PostgreSQLAdapter({ host: 'h', port: 1, database: 'd', user: 'u', password: 'p' })
    const ok = await adapter.checkConnection()
    expect(ok).toBe(true)

    fake.query.mockRejectedValue(new Error('boom'))
    const failed = await adapter.checkConnection()
    expect(failed).toBe(false)
  })
})