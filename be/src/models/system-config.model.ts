
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { SystemConfig } from './types.js';

export class SystemConfigModel extends BaseModel<SystemConfig> {
  protected tableName = 'system_configs';
  protected knex = db;

  async findById(key: string): Promise<SystemConfig | undefined> {
      return this.knex(this.tableName).where({ key }).first();
  }
}
