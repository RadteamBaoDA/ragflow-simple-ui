
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { User } from '@/models/types.js';

/**
 * Model class for interacting with the 'users' table.
 * Extends BaseModel for standard CRUD operations and adds user-specific queries.
 */
export class UserModel extends BaseModel<User> {
  /** The name of the database table. */
  protected tableName = 'users';

  /** The Knex instance used for database operations. */
  protected knex = db;

  /**
   * Finds a user by their email address.
   *
   * @param email - The email address to search for.
   * @returns A promise that resolves to the user object if found, or undefined.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    return this.knex(this.tableName).where({ email }).first();
  }
}
