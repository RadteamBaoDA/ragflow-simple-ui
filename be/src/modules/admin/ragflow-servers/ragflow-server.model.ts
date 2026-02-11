
/**
 * RagflowServer model: manages RAGFlow server connections.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { RagflowServer } from '@/models/types.js'

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
