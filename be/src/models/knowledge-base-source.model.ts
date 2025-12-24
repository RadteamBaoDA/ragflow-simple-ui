
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { KnowledgeBaseSource } from './types.js';

export class KnowledgeBaseSourceModel extends BaseModel<KnowledgeBaseSource> {
  protected tableName = 'knowledge_base_sources';
  protected knex = db;
}
