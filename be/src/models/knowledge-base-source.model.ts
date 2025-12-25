
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { KnowledgeBaseSource } from '@/models/types.js';

/**
 * Model class for interacting with the 'knowledge_base_sources' table.
 * Extends BaseModel for standard CRUD operations.
 */
export class KnowledgeBaseSourceModel extends BaseModel<KnowledgeBaseSource> {
  /** The name of the database table. */
  protected tableName = 'knowledge_base_sources';

  /** The Knex instance used for database operations. */
  protected knex = db;
}
