
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { User } from './types.js';

export class UserModel extends BaseModel<User> {
  protected tableName = 'users';
  protected knex = db;

  async findByEmail(email: string): Promise<User | undefined> {
    return this.knex(this.tableName).where({ email }).first();
  }
}
