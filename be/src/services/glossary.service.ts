
/**
 * Glossary Service — Business logic for glossary tasks and keywords.
 * Implements Singleton Pattern via module-level instance.
 * Tasks and keywords are independent entities.
 * @module services/glossary.service
 */
import { ModelFactory } from '@/models/factory.js';
import { GlossaryTask, GlossaryKeyword, BulkImportGlossaryRow, BulkImportGlossaryResult } from '@/models/types.js';
import { log } from '@/services/logger.service.js';

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
     * Get a single task by ID.
     * @param id - Task UUID
     * @returns Task, or undefined
     */
    async getTask(id: string): Promise<GlossaryTask | undefined> {
        return ModelFactory.glossaryTask.findById(id);
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
     * Delete a glossary task.
     * @param id - Task UUID
     */
    async deleteTask(id: string): Promise<void> {
        return ModelFactory.glossaryTask.delete(id);
    }

    // ========================================================================
    // Keyword Operations
    // ========================================================================

    /**
     * List all keywords.
     * @returns Array of keywords sorted by sort_order then name
     */
    async listKeywords(): Promise<GlossaryKeyword[]> {
        return ModelFactory.glossaryKeyword.findAll(undefined, {
            orderBy: { sort_order: 'asc', name: 'asc' },
        });
    }

    /**
     * Create a new keyword.
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
     * Combines task_instruction_en (Line 1) with context_template (Line 2)
     * replacing {keyword} with selected keyword names.
     * @param taskId - Task UUID
     * @param keywordIds - Array of keyword UUIDs to include
     * @returns Generated prompt string
     */
    async generatePrompt(taskId: string, keywordIds: string[]): Promise<string> {
        // Fetch the task
        const task = await ModelFactory.glossaryTask.findById(taskId);
        if (!task) throw new Error('Task not found');

        // Fetch selected keywords by IDs
        const allKeywords = await ModelFactory.glossaryKeyword.findAll();
        const selectedKeywords = allKeywords.filter((kw) => keywordIds.includes(kw.id));

        if (selectedKeywords.length === 0) {
            throw new Error('No valid keywords selected');
        }

        // Build prompt: Line 1 (instruction) + Line 2 (context per keyword)
        const keywordNames = selectedKeywords.map((kw) => kw.name).join(', ');
        const contextLine = task.context_template.replace(/\{keyword\}/g, keywordNames);

        return `${task.task_instruction_en}\n${contextLine}`;
    }

    // ========================================================================
    // Bulk Import
    // ========================================================================

    /** Chunk size for bulk import operations */
    private readonly CHUNK_SIZE = 100;

    /**
     * Bulk import glossary tasks from parsed Excel rows.
     * Processes in chunks of CHUNK_SIZE with separate transactions per chunk.
     * Skips duplicates by name (case-insensitive).
     * @param rows - Parsed rows from Excel import
     * @param userId - User performing the import
     * @returns Import result with counts
     */
    async bulkImport(rows: BulkImportGlossaryRow[], userId?: string): Promise<BulkImportGlossaryResult> {
        const result: BulkImportGlossaryResult = {
            success: true,
            tasksCreated: 0,
            skipped: 0,
            errors: [],
        };

        // Deduplicate rows by task_name in-memory (keep first occurrence)
        const seen = new Set<string>();
        const totalRows = rows.length;
        const totalChunks = Math.ceil(totalRows / this.CHUNK_SIZE);

        log.info(`[Glossary] Task bulk import started`, { totalRows, totalChunks, chunkSize: this.CHUNK_SIZE });

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * this.CHUNK_SIZE;
            const chunk = rows.slice(start, start + this.CHUNK_SIZE);

            log.debug(`[Glossary] Processing task chunk ${chunkIndex + 1}/${totalChunks}`, {
                chunkStart: start,
                chunkEnd: start + chunk.length,
                chunkSize: chunk.length,
            });

            try {
                // Delegate transactional insert to model layer
                const chunkResult = await ModelFactory.glossaryTask.bulkInsertChunk(chunk, seen, userId);
                result.tasksCreated += chunkResult.created;
                result.skipped += chunkResult.skipped;

                log.debug(`[Glossary] Task chunk ${chunkIndex + 1}/${totalChunks} committed`, {
                    created: result.tasksCreated,
                    skipped: result.skipped,
                });
            } catch (error: any) {
                log.error(`[Glossary] Task chunk ${chunkIndex + 1}/${totalChunks} failed`, { error: error.message });
                result.errors.push(`Chunk ${chunkIndex + 1} failed: ${error.message}`);
            }
        }

        result.success = result.errors.length === 0;
        log.info(`[Glossary] Task bulk import completed`, {
            totalRows,
            created: result.tasksCreated,
            skipped: result.skipped,
            errors: result.errors.length,
        });

        return result;
    }

    /**
     * Bulk import keywords from parsed Excel rows.
     * Processes in chunks of CHUNK_SIZE with separate transactions per chunk.
     * Skips duplicates by name (case-insensitive).
     * @param rows - Parsed rows with name, en_keyword, description
     * @param userId - User performing the import
     * @returns Import result with counts
     */
    async bulkImportKeywords(
        rows: { name: string; en_keyword?: string; description?: string }[],
        userId?: string
    ): Promise<{ success: boolean; created: number; skipped: number; errors: string[] }> {
        const result = { success: true, created: 0, skipped: 0, errors: [] as string[] };

        // Track names seen across all chunks to skip duplicates within the file
        const seen = new Set<string>();
        const totalRows = rows.length;
        const totalChunks = Math.ceil(totalRows / this.CHUNK_SIZE);

        log.info(`[Glossary] Keyword bulk import started`, { totalRows, totalChunks, chunkSize: this.CHUNK_SIZE });

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * this.CHUNK_SIZE;
            const chunk = rows.slice(start, start + this.CHUNK_SIZE);

            log.debug(`[Glossary] Processing keyword chunk ${chunkIndex + 1}/${totalChunks}`, {
                chunkStart: start,
                chunkEnd: start + chunk.length,
                chunkSize: chunk.length,
            });

            try {
                // Delegate transactional insert to model layer
                const chunkResult = await ModelFactory.glossaryKeyword.bulkInsertChunk(chunk, seen, userId);
                result.created += chunkResult.created;
                result.skipped += chunkResult.skipped;

                log.debug(`[Glossary] Keyword chunk ${chunkIndex + 1}/${totalChunks} committed`, {
                    created: result.created,
                    skipped: result.skipped,
                });
            } catch (error: any) {
                log.error(`[Glossary] Keyword chunk ${chunkIndex + 1}/${totalChunks} failed`, { error: error.message });
                result.errors.push(`Chunk ${chunkIndex + 1} failed: ${error.message}`);
            }
        }

        result.success = result.errors.length === 0;
        log.info(`[Glossary] Keyword bulk import completed`, {
            totalRows,
            created: result.created,
            skipped: result.skipped,
            errors: result.errors.length,
        });

        return result;
    }
}

/**
 * Singleton instance of GlossaryService.
 * Import this instance for all glossary operations.
 */
export const glossaryService = new GlossaryService();
