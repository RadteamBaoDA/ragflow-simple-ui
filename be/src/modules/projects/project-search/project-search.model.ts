/**
 * ProjectSearch model: manages AI Search apps linked to projects.
 */
import { BaseModel } from "@/shared/models/base.model.js";
import { db } from "@/shared/db/knex.js";
import { ProjectSearch } from "@/shared/models/types.js";

/**
 * ProjectSearchModel
 * CRUD operations for project search app records.
 * @extends BaseModel<ProjectSearch>
 */
export class ProjectSearchModel extends BaseModel<ProjectSearch> {
  /** Database table name */
  protected tableName = "project_searches";
  /** Shared Knex database instance */
  protected knex = db;

  /**
   * Find all searches for a specific project.
   * @param projectId - UUID of the project
   * @returns Array of search records ordered by creation date desc
   */
  async findByProject(projectId: string): Promise<ProjectSearch[]> {
    return this.knex(this.tableName)
      .where({ project_id: projectId })
      .orderBy("created_at", "desc");
  }

  /**
   * Find a search by its RAGFlow search ID.
   * @param ragflowSearchId - RAGFlow search app ID
   * @returns Search record if found
   */
  async findByRagflowSearchId(
    ragflowSearchId: string,
  ): Promise<ProjectSearch | undefined> {
    return this.knex(this.tableName)
      .where({ ragflow_search_id: ragflowSearchId })
      .first();
  }
}
