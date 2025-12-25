
/**
 * Users table model: lookup by id/email and shared CRUD helpers.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { User } from '@/models/types.js'

export class UserModel extends BaseModel<User> {
  protected tableName = 'users'
  protected knex = db

  async findByEmail(email: string): Promise<User | undefined> {
    // Used by auth flow to bind sessions to existing users
    return this.knex(this.tableName).where({ email }).first()
  }
}
