
/**
 * RagflowServer model: manages RAGFlow server connections.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { RagflowServer } from '@/shared/models/types.js'

/**
 * RagflowServerModel
 * CRUD operations for RAGFlow server connection records.
 * @extends BaseModel<RagflowServer>
 */
export class RagflowServerModel extends BaseModel<RagflowServer> {
  /** Database table name */
  protected tableName = 'ragflow_servers'
  /** Shared Knex database instance */
  protected knex = db
}
