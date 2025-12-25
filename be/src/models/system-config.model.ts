
/**
 * System config model: key/value storage with overridden helpers keyed by `key` column.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { SystemConfig } from '@/models/types.js'

export class SystemConfigModel extends BaseModel<SystemConfig> {
  protected tableName = 'system_configs'
  protected knex = db

  async findById(key: string): Promise<SystemConfig | undefined> {
    return this.knex(this.tableName).where({ key }).first()
  }

  async update(key: string | Partial<SystemConfig>, data: Partial<SystemConfig>): Promise<SystemConfig | undefined> {
    // Override to support natural key updates without numeric id
    const query = this.knex(this.tableName)
    if (typeof key === 'object') {
      query.where(key)
    } else {
      query.where({ key })
    }
    const [result] = await query.update(data).returning('*')
    return result
  }

  async delete(key: string | Partial<SystemConfig>): Promise<void> {
    const query = this.knex(this.tableName)
    if (typeof key === 'object') {
      query.where(key)
    } else {
      query.where({ key })
    }
    await query.delete()
  }
}
