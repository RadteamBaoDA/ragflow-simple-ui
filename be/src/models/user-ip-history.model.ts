
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { UserIpHistory } from './types.js';

export class UserIpHistoryModel extends BaseModel<UserIpHistory> {
  protected tableName = 'user_ip_history';
  protected knex = db;

  async findByUserAndIp(userId: string, ipAddress: string): Promise<UserIpHistory | undefined> {
    return this.knex(this.tableName).where({ user_id: userId, ip_address: ipAddress }).first();
  }
}
