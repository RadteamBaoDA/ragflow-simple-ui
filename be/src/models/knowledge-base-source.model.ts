
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

  /**
   * Get names of sources where type is 'chat'.
   * Used to populate the tags dropdown in the prompt form.
   * @returns Array of chat source names
   */
  async getChatSourceNames(): Promise<string[]> {
    const result = await this.knex(this.tableName)
      .select('name')
      .where('type', 'chat')
      .orderBy('name', 'asc');
    return result.map((r: any) => r.name);
  }

  /**
   * Find sources by type.
   * @param type - Source type ('chat' or 'search')
   * @returns Array of sources matching the type
   */
  async findByType(type: string): Promise<KnowledgeBaseSource[]> {
    return this.knex(this.tableName)
      .where('type', type)
      .orderBy('name', 'asc');
  }
}
