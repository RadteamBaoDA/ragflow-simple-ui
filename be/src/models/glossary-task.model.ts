
/**
 * GlossaryTaskModel — Data access layer for glossary_tasks table.
 * Extends BaseModel for standard CRUD and adds custom query methods.
 * @module models/glossary-task.model
 */
import { Knex } from 'knex';
import { BaseModel } from '@/models/base.model.js';
import { GlossaryTask, GlossaryKeyword } from '@/models/types.js';
import { db } from '@/db/knex.js';

/**
 * GlossaryTask with nested keywords for tree-view responses.
 */
export interface GlossaryTaskWithKeywords extends GlossaryTask {
    /** Keywords belonging to this task */
    keywords: GlossaryKeyword[];
}

/**
 * Model for glossary_tasks table operations.
 * Provides hierarchical task management for the prompt builder.
 */
export class GlossaryTaskModel extends BaseModel<GlossaryTask> {
    protected tableName = 'glossary_tasks';
    protected knex: Knex = db;

    /**
     * Search tasks by name using case-insensitive LIKE.
     * @param query - Search query string
     * @param limit - Maximum results to return
     * @returns Array of matching tasks
     */
    async searchByName(query: string, limit = 50): Promise<GlossaryTask[]> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) LIKE ?', [`%${query.toLowerCase()}%`])
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc')
            .limit(limit);
    }

    /**
     * Find a task by exact name match.
     * @param name - Exact task name to find
     * @returns Task if found, undefined otherwise
     */
    async findByName(name: string): Promise<GlossaryTask | undefined> {
        return this.knex(this.tableName)
            .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
            .first();
    }

    /**
     * Get a single task with its keywords.
     * @param id - Task ID
     * @returns Task with keywords array, or undefined
     */
    async getWithKeywords(id: string): Promise<GlossaryTaskWithKeywords | undefined> {
        // Fetch the task
        const task = await this.findById(id);
        if (!task) return undefined;

        // Fetch keywords for this task
        const keywords = await this.knex('glossary_keywords')
            .where({ task_id: id })
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc');

        return { ...task, keywords };
    }

    /**
     * Get all tasks with their keywords (tree structure).
     * Used by the Prompt Builder modal to display the full glossary tree.
     * @param activeOnly - If true, only return active tasks and keywords
     * @returns Array of tasks each with their keywords
     */
    async getAllWithKeywords(activeOnly = false): Promise<GlossaryTaskWithKeywords[]> {
        // Build tasks query
        const tasksQuery = this.knex(this.tableName)
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc');
        if (activeOnly) {
            tasksQuery.where({ is_active: true });
        }
        const tasks = await tasksQuery;

        if (tasks.length === 0) return [];

        // Fetch all keywords in a single query for efficiency
        const taskIds = tasks.map((t: GlossaryTask) => t.id);
        const keywordsQuery = this.knex('glossary_keywords')
            .whereIn('task_id', taskIds)
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc');
        if (activeOnly) {
            keywordsQuery.where({ is_active: true });
        }
        const allKeywords: GlossaryKeyword[] = await keywordsQuery;

        // Group keywords by task_id
        const keywordsByTask = new Map<string, GlossaryKeyword[]>();
        for (const kw of allKeywords) {
            const existing = keywordsByTask.get(kw.task_id) || [];
            existing.push(kw);
            keywordsByTask.set(kw.task_id, existing);
        }

        // Merge tasks with their keywords
        return tasks.map((task: GlossaryTask) => ({
            ...task,
            keywords: keywordsByTask.get(task.id) || [],
        }));
    }

    /**
     * Find or create a task by name.
     * Used during bulk import to ensure tasks exist.
     * @param name - Task name
     * @param taskInstruction - Line 1 prompt instruction
     * @param contextTemplate - Line 2 context template with {keyword}
     * @param userId - User performing the action
     * @returns The found or created task
     */
    async findOrCreate(
        name: string,
        taskInstruction: string,
        contextTemplate: string,
        userId?: string
    ): Promise<GlossaryTask> {
        // Check if task already exists
        const existing = await this.findByName(name);
        if (existing) return existing;

        // Create new task
        return this.create({
            name: name.trim(),
            task_instruction: taskInstruction,
            context_template: contextTemplate,
            created_by: userId || null,
            updated_by: userId || null,
        });
    }
}
