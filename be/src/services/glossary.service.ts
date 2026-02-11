
/**
 * Glossary Service — Business logic for glossary tasks and keywords.
 * Implements Singleton Pattern via module-level instance.
 * @module services/glossary.service
 */
import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';
import { GlossaryTask, GlossaryKeyword, BulkImportGlossaryRow, BulkImportGlossaryResult } from '@/models/types.js';
import { GlossaryTaskWithKeywords } from '@/models/glossary-task.model.js';

/**
 * Service class for glossary management operations.
 * Handles tasks, keywords, prompt generation, and bulk import.
 */
class GlossaryService {

    // ========================================================================
    // Task Operations
    // ========================================================================

    /**
     * List all glossary tasks.
     * @param activeOnly - If true, only return active tasks
     * @returns Array of tasks
     */
    async listTasks(activeOnly = false): Promise<GlossaryTask[]> {
        const filter = activeOnly ? { is_active: true } : undefined;
        return ModelFactory.glossaryTask.findAll(filter, {
            orderBy: { sort_order: 'asc', name: 'asc' },
        });
    }

    /**
     * Get a single task with its keywords.
     * @param id - Task UUID
     * @returns Task with keywords, or undefined
     */
    async getTaskWithKeywords(id: string): Promise<GlossaryTaskWithKeywords | undefined> {
        return ModelFactory.glossaryTask.getWithKeywords(id);
    }

    /**
     * Create a new glossary task.
     * @param data - Task data to create
     * @returns Created task
     */
    async createTask(data: Partial<GlossaryTask>): Promise<GlossaryTask> {
        return ModelFactory.glossaryTask.create(data);
    }

    /**
     * Update an existing glossary task.
     * @param id - Task UUID
     * @param data - Fields to update
     * @returns Updated task
     */
    async updateTask(id: string, data: Partial<GlossaryTask>): Promise<GlossaryTask | undefined> {
        return ModelFactory.glossaryTask.update(id, {
            ...data,
            updated_at: new Date(),
        });
    }

    /**
     * Delete a glossary task and its keywords (cascading).
     * @param id - Task UUID
     */
    async deleteTask(id: string): Promise<void> {
        return ModelFactory.glossaryTask.delete(id);
    }

    // ========================================================================
    // Keyword Operations
    // ========================================================================

    /**
     * List keywords for a specific task.
     * @param taskId - Task UUID
     * @returns Array of keywords
     */
    async listKeywords(taskId: string): Promise<GlossaryKeyword[]> {
        return ModelFactory.glossaryKeyword.findByTaskId(taskId);
    }

    /**
     * Create a new keyword under a task.
     * @param data - Keyword data to create
     * @returns Created keyword
     */
    async createKeyword(data: Partial<GlossaryKeyword>): Promise<GlossaryKeyword> {
        return ModelFactory.glossaryKeyword.create(data);
    }

    /**
     * Update an existing keyword.
     * @param id - Keyword UUID
     * @param data - Fields to update
     * @returns Updated keyword
     */
    async updateKeyword(id: string, data: Partial<GlossaryKeyword>): Promise<GlossaryKeyword | undefined> {
        return ModelFactory.glossaryKeyword.update(id, {
            ...data,
            updated_at: new Date(),
        });
    }

    /**
     * Delete a keyword.
     * @param id - Keyword UUID
     */
    async deleteKeyword(id: string): Promise<void> {
        return ModelFactory.glossaryKeyword.delete(id);
    }

    // ========================================================================
    // Prompt Builder
    // ========================================================================

    /**
     * Get the full glossary tree (all active tasks with active keywords).
     * Used by the Prompt Builder modal in AI Chat.
     * @returns Array of tasks with their keywords
     */
    async getGlossaryTree(): Promise<GlossaryTaskWithKeywords[]> {
        return ModelFactory.glossaryTask.getAllWithKeywords(true);
    }

    /**
     * Search tasks and keywords by name.
     * Used by the Prompt Builder search feature.
     * @param query - Search string
     * @returns Object with matching tasks and keywords
     */
    async search(query: string): Promise<{
        tasks: GlossaryTask[];
        keywords: GlossaryKeyword[];
    }> {
        const [tasks, keywords] = await Promise.all([
            ModelFactory.glossaryTask.searchByName(query),
            ModelFactory.glossaryKeyword.searchByName(query),
        ]);
        return { tasks, keywords };
    }

    /**
     * Generate a structured prompt from task and keyword selections.
     * Combines task_instruction (Line 1) with context_template (Line 2)
     * replacing {keyword} with selected keyword names.
     * @param taskId - Task UUID
     * @param keywordIds - Array of keyword UUIDs to include
     * @returns Generated prompt string
     */
    async generatePrompt(taskId: string, keywordIds: string[]): Promise<string> {
        // Fetch the task
        const task = await ModelFactory.glossaryTask.findById(taskId);
        if (!task) throw new Error('Task not found');

        // Fetch selected keywords
        const allKeywords = await ModelFactory.glossaryKeyword.findByTaskId(taskId);
        const selectedKeywords = allKeywords.filter((kw) => keywordIds.includes(kw.id));

        if (selectedKeywords.length === 0) {
            throw new Error('No valid keywords selected');
        }

        // Build prompt: Line 1 (instruction) + Line 2 (context per keyword)
        const keywordNames = selectedKeywords.map((kw) => kw.name).join(', ');
        const contextLine = task.context_template.replace(/\{keyword\}/g, keywordNames);

        return `${task.task_instruction}\n${contextLine}`;
    }

    // ========================================================================
    // Bulk Import
    // ========================================================================

    /**
     * Bulk import glossary tasks and keywords from parsed Excel rows.
     * Uses a transaction to ensure atomicity.
     * @param rows - Parsed rows from Excel import
     * @param userId - User performing the import
     * @returns Import result with counts
     */
    async bulkImport(rows: BulkImportGlossaryRow[], userId?: string): Promise<BulkImportGlossaryResult> {
        const result: BulkImportGlossaryResult = {
            success: true,
            tasksCreated: 0,
            keywordsCreated: 0,
            skipped: 0,
            errors: [],
        };

        try {
            await db.transaction(async (trx) => {
                // Group rows by task_name for efficient processing
                const taskGroups = new Map<string, BulkImportGlossaryRow[]>();
                for (const row of rows) {
                    const taskName = row.task_name.trim();
                    if (!taskGroups.has(taskName)) {
                        taskGroups.set(taskName, []);
                    }
                    taskGroups.get(taskName)!.push(row);
                }

                // Process each task group
                for (const [taskName, taskRows] of taskGroups) {
                    // Find or create the task
                    const firstRow = taskRows[0];
                    if (!firstRow) {
                        result.skipped += taskRows.length;
                        continue;
                    }
                    let task = await ModelFactory.glossaryTask.findByName(taskName);

                    if (!task) {
                        // Create new task using the first row's instruction/template
                        task = await ModelFactory.glossaryTask.create({
                            name: taskName,
                            task_instruction: firstRow.task_instruction,
                            context_template: firstRow.context_template,
                            created_by: userId || null,
                            updated_by: userId || null,
                        } as Partial<GlossaryTask>, trx);
                        result.tasksCreated++;
                    }

                    // Create keywords for this task
                    for (const row of taskRows) {
                        if (!row.keyword || !row.keyword.trim()) {
                            result.skipped++;
                            continue;
                        }

                        // Check if keyword already exists
                        const existing = await ModelFactory.glossaryKeyword.findByName(task.id, row.keyword);
                        if (existing) {
                            result.skipped++;
                            continue;
                        }

                        // Create keyword
                        await ModelFactory.glossaryKeyword.create({
                            task_id: task.id,
                            name: row.keyword.trim(),
                            description: row.keyword_description || null,
                            created_by: userId || null,
                            updated_by: userId || null,
                        } as Partial<GlossaryKeyword>, trx);
                        result.keywordsCreated++;
                    }
                }
            });
        } catch (error: any) {
            result.success = false;
            result.errors.push(error.message || 'Bulk import failed');
        }

        return result;
    }
}

/**
 * Singleton instance of GlossaryService.
 * Import this instance for all glossary operations.
 */
export const glossaryService = new GlossaryService();
