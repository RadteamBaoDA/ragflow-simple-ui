
/**
 * Prompt model: manages prompts in the knowledge base.
 * Provides custom query methods for prompt-specific operations.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { Prompt } from '@/models/types.js'

/**
 * Filter options for querying prompts.
 */
export interface PromptFilterOptions {
  /** Text search query */
  search?: string;
  /** Filter by tag (JSONB contains) */
  tag?: string;
  /** Filter by multiple tags (AND logic - prompt must have all tags) */
  tags?: string[];
  /** Filter by source type */
  source?: string;
}

/**
 * PromptModel extends BaseModel with prompt-specific query methods.
 * Uses Knex ORM for all database operations - no raw SQL in services.
 */
export class PromptModel extends BaseModel<Prompt> {
  protected tableName = 'prompts'
  protected knex = db

  /**
   * Find all active prompts with optional filtering.
   * @param filters - Optional filters for search, tag, and source
   * @returns Array of matching prompts
   */
  async findActiveWithFilters(filters: PromptFilterOptions = {}): Promise<Prompt[]> {
    const { search, tag, source } = filters;

    // Start with active prompts
    let query = this.knex(this.tableName).where('is_active', true);

    // Apply source filter
    if (source) {
      query = query.where('source', source);
    }

    // Apply tag filter (JSONB array contains) - skip if 'All'
    if (tag && tag !== 'All') {
      query = query.whereRaw('tags @> ?', [JSON.stringify([tag])]);
    }

    // Apply full-text search if provided
    if (search) {
      query = query
        .whereRaw("search_vector @@ plainto_tsquery('english', ?)", [search])
        .orderByRaw("ts_rank(search_vector, plainto_tsquery('english', ?)) DESC", [search]);
    } else {
      query = query.orderBy('created_at', 'desc');
    }

    return query;
  }

  /**
   * Find all active prompts with feedback counts included.
   * Uses LEFT JOIN with subquery to aggregate like/dislike counts efficiently.
   * @param filters - Optional filters for search, tag, source, limit, and offset
   * @returns Object with data array and total count for pagination
   */
  async findActiveWithFeedbackCounts(filters: PromptFilterOptions & { limit?: number; offset?: number } = {}): Promise<{ data: (Prompt & { like_count: number; dislike_count: number })[]; total: number }> {
    const { search, tag, tags, source, limit = 25, offset = 0 } = filters;

    // Subquery to aggregate feedback counts per prompt
    const feedbackSubquery = this.knex('prompt_interactions')
      .select('prompt_id')
      .select(this.knex.raw("COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as like_count"))
      .select(this.knex.raw("COUNT(CASE WHEN interaction_type = 'dislike' THEN 1 END) as dislike_count"))
      .groupBy('prompt_id')
      .as('fb');

    // Build base query conditions
    let baseQuery = this.knex(this.tableName + ' as p')
      .leftJoin(feedbackSubquery, 'p.id', 'fb.prompt_id')
      .where('p.is_active', true);

    // Apply source filter
    if (source) {
      baseQuery = baseQuery.where('p.source', source);
    }

    // Apply single tag filter (JSONB array contains) - skip if 'All'
    if (tag && tag !== 'All') {
      baseQuery = baseQuery.whereRaw('p.tags @> ?', [JSON.stringify([tag])]);
    }

    // Apply multiple tags filter with AND logic (prompt must contain ALL selected tags)
    if (tags && tags.length > 0) {
      tags.forEach(t => {
        baseQuery = baseQuery.whereRaw('p.tags @> ?', [JSON.stringify([t])]);
      });
    }

    // Apply full-text search if provided
    if (search) {
      baseQuery = baseQuery.whereRaw("p.search_vector @@ plainto_tsquery('english', ?)", [search]);
    }

    // Get total count first
    const countResult = await baseQuery.clone().count('p.id as count').first();
    const total = parseInt(countResult?.count as string || '0', 10);

    // Main query with pagination and ordering
    let dataQuery = baseQuery.clone()
      .select(
        'p.*',
        this.knex.raw('COALESCE(fb.like_count, 0)::int as like_count'),
        this.knex.raw('COALESCE(fb.dislike_count, 0)::int as dislike_count')
      );

    // Apply ordering
    if (search) {
      dataQuery = dataQuery.orderByRaw("ts_rank(p.search_vector, plainto_tsquery('english', ?)) DESC", [search]);
    } else {
      dataQuery = dataQuery.orderBy('p.created_at', 'desc');
    }

    // Apply pagination
    dataQuery = dataQuery.limit(limit).offset(offset);

    const data = await dataQuery;
    return { data, total };
  }

  /**
   * Search prompts using full-text search on prompt and description.
   * @param searchQuery - Text to search for
   * @returns Array of matching prompts ordered by relevance
   */
  async search(searchQuery: string): Promise<Prompt[]> {
    return this.knex(this.tableName)
      .whereRaw("search_vector @@ plainto_tsquery('english', ?)", [searchQuery])
      .orderByRaw("ts_rank(search_vector, plainto_tsquery('english', ?)) DESC", [searchQuery]);
  }

  /**
   * Get all unique tags from active prompts.
   * @returns Array of unique tag strings
   */
  async getAllTags(): Promise<string[]> {
    const result = await this.knex(this.tableName)
      .select(this.knex.raw('DISTINCT jsonb_array_elements_text(tags) as tag'))
      .where('is_active', true);
    return result.map((r: any) => r.tag);
  }

  /**
   * Get all unique sources from active prompts.
   * @returns Array of unique source strings
   */
  async getAllSources(): Promise<string[]> {
    const result = await this.knex(this.tableName)
      .distinct('source')
      .where('is_active', true)
      .whereNotNull('source')
      .orderBy('source', 'asc');
    return result.map((r: any) => r.source);
  }

  /**
   * Check if a prompt with the given text already exists.
   * @param promptText - The prompt text to check
   * @returns The existing prompt if found, undefined otherwise
   */
  async findByPromptText(promptText: string): Promise<Prompt | undefined> {
    return this.knex(this.tableName)
      .where('prompt', promptText)
      .where('is_active', true)
      .first();
  }
}
