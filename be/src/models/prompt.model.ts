
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
