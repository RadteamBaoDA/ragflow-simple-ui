
/**
 * PromptInteraction model: manages likes, dislikes, and comments for prompts.
 * Provides custom query methods for interaction-specific operations.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { PromptInteraction } from '@/models/types.js'

/**
 * Feedback counts structure for prompt interactions.
 */
export interface FeedbackCounts {
    like_count: number;
    dislike_count: number;
}

/**
 * Interaction with user email from join.
 */
export interface InteractionWithUser extends PromptInteraction {
    user_email?: string;
}

/**
 * PromptInteractionModel extends BaseModel with interaction-specific query methods.
 * Uses Knex ORM for all database operations - no raw SQL in services.
 */
export class PromptInteractionModel extends BaseModel<PromptInteraction> {
    protected tableName = 'prompt_interactions'
    protected knex = db

    /**
     * Get feedback counts (likes/dislikes) for a specific prompt.
     * @param promptId - ID of the prompt to get counts for
     * @returns Object with like_count and dislike_count
     */
    async getFeedbackCounts(promptId: string): Promise<FeedbackCounts> {
        const result = await this.knex(this.tableName)
            .where('prompt_id', promptId)
            .select(
                this.knex.raw("COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as like_count"),
                this.knex.raw("COUNT(CASE WHEN interaction_type = 'dislike' THEN 1 END) as dislike_count")
            )
            .first();

        return {
            like_count: parseInt(result?.like_count || '0', 10),
            dislike_count: parseInt(result?.dislike_count || '0', 10)
        };
    }

    /**
     * Get all interactions for a prompt with user email, optionally filtered by date.
     * @param promptId - ID of the prompt
     * @param startDate - Optional start date filter (ISO string)
     * @param endDate - Optional end date filter (ISO string)
     * @returns Array of interactions with user email
     */
    async getInteractionsWithUser(
        promptId: string,
        startDate?: string,
        endDate?: string
    ): Promise<InteractionWithUser[]> {
        let query = this.knex(this.tableName + ' as pi')
            .leftJoin('users as u', 'pi.user_id', 'u.id')
            .where('pi.prompt_id', promptId)
            .select(
                'pi.id',
                'pi.prompt_id',
                'pi.user_id',
                'u.email as user_email',
                'pi.interaction_type',
                'pi.comment',
                'pi.created_at'
            )
            .orderBy('pi.created_at', 'desc');

        // Apply date range filters if provided
        if (startDate) {
            query = query.where('pi.created_at', '>=', startDate);
        }
        if (endDate) {
            query = query.where('pi.created_at', '<=', endDate);
        }

        return query;
    }

    /**
     * Get all interactions for a specific user.
     * @param userId - ID of the user
     * @returns Array of user's interactions
     */
    async findByUserId(userId: string): Promise<PromptInteraction[]> {
        return this.knex(this.tableName)
            .where('user_id', userId)
            .orderBy('created_at', 'desc');
    }

    /**
     * Get all interactions for a specific prompt.
     * @param promptId - ID of the prompt
     * @returns Array of interactions for the prompt
     */
    async findByPromptId(promptId: string): Promise<PromptInteraction[]> {
        return this.knex(this.tableName)
            .where('prompt_id', promptId)
            .orderBy('created_at', 'desc');
    }
}
