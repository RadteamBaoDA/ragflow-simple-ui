
/**
 * Project model: manages centralized project records.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { Project } from '@/models/types.js'

/**
 * ProjectModel
 * CRUD operations for project records.
 * @extends BaseModel<Project>
 */
export class ProjectModel extends BaseModel<Project> {
  /** Database table name */
  protected tableName = 'projects'
  /** Shared Knex database instance */
  protected knex = db
}
