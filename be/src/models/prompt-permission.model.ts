/**
 * PromptPermission model: manages feature-level permissions for Prompts.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { PromptPermission } from '@/models/types.js'

// Using PromptPermission type instead of DocumentPermission
export class PromptPermissionModel extends BaseModel<PromptPermission> {
    protected tableName = 'prompt_permissions'
    protected knex = db

    /**
     * Find permission by entity type and ID.
     * @param entityType - 'user' or 'team'
     * @param entityId - UUID of the entity
     */
    async findByEntity(entityType: string, entityId: string): Promise<PromptPermission | undefined> {
        return this.knex(this.tableName)
            .where({ entity_type: entityType, entity_id: entityId })
            .first();
    }
}
