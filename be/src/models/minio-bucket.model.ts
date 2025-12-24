
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { MinioBucket } from './types.js';

export class MinioBucketModel extends BaseModel<MinioBucket> {
  protected tableName = 'minio_buckets';
  protected knex = db;

  async findByName(bucketName: string): Promise<MinioBucket | undefined> {
    return this.knex(this.tableName).where({ bucket_name: bucketName }).first();
  }
}

export class CreateMinioBucketDto {
    name: string;
    description?: string | undefined; // Align with exactOptionalPropertyTypes

    constructor(name: string, description?: string) {
        this.name = name;
        this.description = description;
    }
}
