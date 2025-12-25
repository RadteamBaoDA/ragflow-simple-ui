
/**
 * Managed MinIO bucket model: tracks application-owned buckets with metadata.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { MinioBucket } from '@/models/types.js'

export class MinioBucketModel extends BaseModel<MinioBucket> {
  protected tableName = 'minio_buckets'
  protected knex = db

  async findByName(bucketName: string): Promise<MinioBucket | undefined> {
    return this.knex(this.tableName).where({ bucket_name: bucketName }).first()
  }

  async findByIds(ids: string[]): Promise<MinioBucket[]> {
    return this.knex(this.tableName).whereIn('id', ids).orderBy('created_at', 'desc')
  }
}

export class CreateMinioBucketDto {
  name: string
  description?: string | undefined // Align with exactOptionalPropertyTypes

  constructor(name: string, description?: string) {
    this.name = name
    this.description = description
  }
}
