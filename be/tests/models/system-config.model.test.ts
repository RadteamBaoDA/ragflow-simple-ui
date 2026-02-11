/**
 * @fileoverview Tests for SystemConfigModel key-based helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SystemConfigModel } from '../../src/shared/models/system-config.model.js'

const makeBuilder = (rows: any[] = [], updateResult: any = undefined) => {
  const calls: any[] = []
  const builder: any = {
    calls,
    where: vi.fn((arg: any) => {
      calls.push({ type: 'where', arg })
      return builder
    }),
    first: vi.fn(() => Promise.resolve(rows[0])),
    update: vi.fn((data: any) => {
      calls.push({ type: 'update', data })
      return {
        returning: vi.fn(() => [updateResult ?? { ...rows[0], ...data }]),
      }
    }),
    delete: vi.fn(() => Promise.resolve()),
  }
  return builder
}

describe('SystemConfigModel', () => {
  let model: SystemConfigModel
  let builder: any
  let mockKnex: any

  const setup = (rows: any[], updateResult?: any) => {
    builder = makeBuilder(rows, updateResult)
    mockKnex = vi.fn(() => builder)
    model = new SystemConfigModel()
    ;(model as any).knex = mockKnex
  }

  beforeEach(() => {
    setup([])
  })

  it('findById queries by key and returns first row', async () => {
    const row = { key: 'k1', value: 'v1' }
    setup([row])

    const result = await model.findById('k1')

    expect(mockKnex).toHaveBeenCalledWith('system_configs')
    expect(builder.where).toHaveBeenCalledWith({ key: 'k1' })
    expect(builder.first).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('update uses key filter and returns updated row', async () => {
    const row = { key: 'k1', value: 'old' }
    setup([row], { key: 'k1', value: 'new' })

    const result = await model.update('k1', { value: 'new' })

    expect(builder.where).toHaveBeenCalledWith({ key: 'k1' })
    expect(builder.update).toHaveBeenCalledWith({ value: 'new' })
    expect(result).toEqual({ key: 'k1', value: 'new' })
  })

  it('update supports object filter', async () => {
    setup([{ key: 'k1', env: 'dev' }], { key: 'k1', env: 'dev', value: 'v' })

    await model.update({ key: 'k1', env: 'dev' }, { value: 'v' })

    expect(builder.where).toHaveBeenCalledWith({ key: 'k1', env: 'dev' })
  })

  it('delete applies key filter before removal', async () => {
    setup([])

    await model.delete('k1')

    expect(builder.where).toHaveBeenCalledWith({ key: 'k1' })
    expect(builder.delete).toHaveBeenCalled()
  })
})
