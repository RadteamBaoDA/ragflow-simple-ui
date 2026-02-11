
/**
 * System config model: key/value storage with overridden helpers keyed by `key` column.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { SystemConfig } from '@/shared/models/types.js'

/**
 * SystemConfigModel
 * Key/value storage for system configuration.
 * Overrides base methods to use 'key' column instead of numeric 'id'.
 */
export class SystemConfigModel extends BaseModel<SystemConfig> {
  /** Database table name */
  protected tableName = 'system_configs'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find a config entry by its key.
   * Overrides base findById to use 'key' column.
   * @param key - Configuration key to look up
   * @returns Promise<SystemConfig | undefined> - Config record if found, undefined otherwise
   * @description Overrides standard ID lookup to use the string 'key' column.
   */
  async findById(key: string): Promise<SystemConfig | undefined> {
    // Query by 'key' column instead of default 'id'
    return this.knex(this.tableName).where({ key }).first()
  }

  /**
   * Update a config entry by key or filter object.
   * Overrides base update to support natural key updates.
   * @param key - Config key string or filter object
   * @param data - Partial data to update
   * @returns Promise<SystemConfig | undefined> - Updated config record if found, undefined otherwise
   * @description Handles both simple key lookup and complex filter objects for updates.
   */
  async update(key: string | Partial<SystemConfig>, data: Partial<SystemConfig>): Promise<SystemConfig | undefined> {
    // Build base query
    const query = this.knex(this.tableName)

    // Handle both string key and object filter
    if (typeof key === 'object') {
      // Object filter - use as WHERE conditions
      query.where(key)
    } else {
      // String key - look up by 'key' column
      query.where({ key })
    }

    // Apply updates and return the updated record
    const [result] = await query.update(data).returning('*')
    return result
  }

  /**
   * Delete a config entry by key or filter object.
   * Overrides base delete to use 'key' column.
   * @param key - Config key string or filter object
   * @returns Promise<void>
   * @description Handles deletion by string key or complex filter object.
   */
  async delete(key: string | Partial<SystemConfig>): Promise<void> {
    // Build base query
    const query = this.knex(this.tableName)

    // Handle both string key and object filter
    if (typeof key === 'object') {
      // Object filter - use as WHERE conditions
      query.where(key)
    } else {
      // String key - look up by 'key' column
      query.where({ key })
    }

    // Execute deletion
    await query.delete()
  }
}
