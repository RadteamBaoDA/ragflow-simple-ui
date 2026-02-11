
/**
 * ProjectChat model: manages chat assistants linked to projects.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { ProjectChat } from '@/shared/models/types.js'

/**
 * ProjectChatModel
 * CRUD operations for project chat assistant records.
 * @extends BaseModel<ProjectChat>
 */
export class ProjectChatModel extends BaseModel<ProjectChat> {
  /** Database table name */
  protected tableName = 'project_chats'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find all chats for a specific project.
   * @param projectId - UUID of the project
   * @returns Array of chat records ordered by creation date desc
   */
  async findByProject(projectId: string): Promise<ProjectChat[]> {
    return this.knex(this.tableName)
      .where({ project_id: projectId })
      .orderBy('created_at', 'desc')
  }

  /**
   * Find a chat by its RAGFlow chat ID.
   * @param ragflowChatId - RAGFlow chat assistant ID
   * @returns Chat record if found
   */
  async findByRagflowChatId(ragflowChatId: string): Promise<ProjectChat | undefined> {
    return this.knex(this.tableName)
      .where({ ragflow_chat_id: ragflowChatId })
      .first()
  }
}
