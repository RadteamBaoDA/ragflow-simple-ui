
/**
 * Users table model: lookup by id/email and shared CRUD helpers.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { User } from '@/shared/models/types.js'

/**
 * UserModel
 * Represents the 'users' table.
 * Core user identity management.
 */
export class UserModel extends BaseModel<User> {
  /** Table name in the database */
  protected tableName = 'users'
  /** Knex connection instance */
  protected knex = db

  /**
   * Find a user by their email address.
   * @param email - Email address to search for
   * @returns Promise<User | undefined> - User record if found
   * @description Common lookup used during authentication to link sessions to users.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    // Used by auth flow to bind sessions to existing users
    return this.knex(this.tableName).where({ email }).first()
  }
}
