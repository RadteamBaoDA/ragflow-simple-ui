
/**
 * Project model: manages centralized project records.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { Project } from '@/shared/models/types.js'

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
