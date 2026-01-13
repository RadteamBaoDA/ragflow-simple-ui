import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioBucketModel, CreateMinioBucketDto } from '@/models/minio-bucket.model.js'
import { db } from '@/db/knex.js'

vi.mock('@/db/knex.js', () => ({ db: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('MinioBucketModel', () => {
  let model: MinioBucketModel

  beforeEach(() => {
    model = new MinioBucketModel()
  })

  it('findByName queries correct column and returns first', async () => {
    const first = vi.fn().mockResolvedValue({ id: 'm1' })
    const where = vi.fn(() => ({ first }))
    ;(db as any).mockReturnValue({ where })

    const res = await model.findByName('bucket1')
    expect(where).toHaveBeenCalledWith({ bucket_name: 'bucket1' })
    expect(res).toEqual({ id: 'm1' })
  })

  it('findByIds handles empty array but queries db', async () => {
    const orderBy = vi.fn().mockResolvedValue([])
    const whereIn = vi.fn().mockReturnValue({ orderBy })
    ;(db as any).mockReturnValue({ whereIn })

    const res = await model.findByIds([])
    expect(whereIn).toHaveBeenCalledWith('id', [])
    expect(orderBy).toHaveBeenCalledWith('created_at', 'desc')
    expect(res).toEqual([])
  })

  it('findByIds queries whereIn and orders by created_at desc', async () => {
    const orderBy = vi.fn(() => ({ mockResolvedValue: vi.fn() }))
    const whereIn = vi.fn().mockReturnValue({ orderBy })
    ;(db as any).mockReturnValue({ whereIn })

    const res = await (model as any).findByIds(['a'])
    expect(whereIn).toHaveBeenCalledWith('id', ['a'])
    expect(orderBy).toHaveBeenCalledWith('created_at', 'desc')
  })

  it('CreateMinioBucketDto sets fields', () => {
    const dto = new CreateMinioBucketDto('n', 'd')
    expect(dto.name).toBe('n')
    expect(dto.description).toBe('d')
  })
})