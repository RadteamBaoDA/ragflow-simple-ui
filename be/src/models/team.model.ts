
/**
 * Teams model: simple CRUD for team records used in RBAC groupings.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { Team } from '@/models/types.js'

/**
 * TeamModel
 * Represents the 'teams' table.
 * Manages team groups used for Role-Based Access Control (RBAC).
 */
export class TeamModel extends BaseModel<Team> {
  /** Table name in the database */
  protected tableName = 'teams'
  /** Knex connection instance */
  protected knex = db
}
