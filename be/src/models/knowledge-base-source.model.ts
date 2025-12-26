
/**
 * Knowledge base sources model: registry of RAGFlow data sources (url/type/access control).
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { KnowledgeBaseSource } from '@/models/types.js'

/**
 * KnowledgeBaseSourceModel
 * Represents the 'knowledge_base_sources' table.
 * Registry of data sources used for Retrieval Augmented Generation (RAG).
 */
export class KnowledgeBaseSourceModel extends BaseModel<KnowledgeBaseSource> {
  /** Table name in the database */
  protected tableName = 'knowledge_base_sources'
  /** Knex connection instance */
  protected knex = db
}
