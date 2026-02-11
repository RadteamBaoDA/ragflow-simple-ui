
/**
 * Glossary Controller — Handles HTTP requests for glossary management.
 * Delegates business logic to glossaryService.
 * @module controllers/glossary.controller
 */
import { Request, Response } from 'express'
import { glossaryService } from '@/services/glossary.service.js'

/**
 * Controller for glossary tasks and keywords API endpoints.
 */
export class GlossaryController {

    // ========================================================================
    // Task Endpoints
    // ========================================================================

    /**
     * GET /glossary/tasks — List all glossary tasks.
     */
    static async listTasks(_req: Request, res: Response): Promise<void> {
        try {
            const tasks = await glossaryService.listTasks()
            res.json(tasks)
        } catch (error: any) {
            console.error('Error listing glossary tasks:', error)
            res.status(500).json({ error: error.message || 'Failed to list tasks' })
        }
    }

    /**
     * GET /glossary/tasks/:id — Get a single task.
     */
    static async getTask(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id!
            const task = await glossaryService.getTask(id)

            if (!task) {
                res.status(404).json({ error: 'Task not found' })
                return
            }

            res.json(task)
        } catch (error: any) {
            console.error('Error getting glossary task:', error)
            res.status(500).json({ error: error.message || 'Failed to get task' })
        }
    }

    /**
     * POST /glossary/tasks — Create a new glossary task.
     */
    static async createTask(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || null
            const { name, description, task_instruction_en, task_instruction_ja, task_instruction_vi, context_template, sort_order, is_active } = req.body

            // Validate required fields
            if (!name || !task_instruction_en || !context_template) {
                res.status(400).json({
                    error: 'name, task_instruction_en, and context_template are required',
                })
                return
            }

            const task = await glossaryService.createTask({
                name: name.trim(),
                description: description || null,
                task_instruction_en,
                task_instruction_ja: task_instruction_ja || null,
                task_instruction_vi: task_instruction_vi || null,
                context_template,
                sort_order: sort_order || 0,
                is_active: is_active !== false,
                created_by: userId,
                updated_by: userId,
            })

            res.status(201).json(task)
        } catch (error: any) {
            console.error('Error creating glossary task:', error)
            // Handle unique constraint violation
            if (error.message?.includes('unique') || error.code === '23505') {
                res.status(409).json({ error: 'Task name already exists' })
                return
            }
            res.status(500).json({ error: error.message || 'Failed to create task' })
        }
    }

    /**
     * PUT /glossary/tasks/:id — Update a glossary task.
     */
    static async updateTask(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || null
            const id = req.params.id!
            const { name, description, task_instruction_en, task_instruction_ja, task_instruction_vi, context_template, sort_order, is_active } = req.body

            const updateData: Record<string, any> = { updated_by: userId }
            if (name !== undefined) updateData.name = name.trim()
            if (description !== undefined) updateData.description = description
            if (task_instruction_en !== undefined) updateData.task_instruction_en = task_instruction_en
            if (task_instruction_ja !== undefined) updateData.task_instruction_ja = task_instruction_ja
            if (task_instruction_vi !== undefined) updateData.task_instruction_vi = task_instruction_vi
            if (context_template !== undefined) updateData.context_template = context_template
            if (sort_order !== undefined) updateData.sort_order = sort_order
            if (is_active !== undefined) updateData.is_active = is_active

            const task = await glossaryService.updateTask(id, updateData)
            if (!task) {
                res.status(404).json({ error: 'Task not found' })
                return
            }

            res.json(task)
        } catch (error: any) {
            console.error('Error updating glossary task:', error)
            if (error.message?.includes('unique') || error.code === '23505') {
                res.status(409).json({ error: 'Task name already exists' })
                return
            }
            res.status(500).json({ error: error.message || 'Failed to update task' })
        }
    }

    /**
     * DELETE /glossary/tasks/:id — Delete a glossary task.
     */
    static async deleteTask(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id!
            await glossaryService.deleteTask(id)
            res.status(204).send()
        } catch (error: any) {
            console.error('Error deleting glossary task:', error)
            res.status(500).json({ error: error.message || 'Failed to delete task' })
        }
    }

    // ========================================================================
    // Keyword Endpoints
    // ========================================================================

    /**
     * GET /glossary/keywords — List all keywords.
     */
    static async listKeywords(_req: Request, res: Response): Promise<void> {
        try {
            const keywords = await glossaryService.listKeywords()
            res.json(keywords)
        } catch (error: any) {
            console.error('Error listing glossary keywords:', error)
            res.status(500).json({ error: error.message || 'Failed to list keywords' })
        }
    }

    /**
     * POST /glossary/keywords — Create a new keyword.
     */
    static async createKeyword(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || null
            const { name, en_keyword, description, sort_order, is_active } = req.body

            // Validate required fields
            if (!name) {
                res.status(400).json({ error: 'name is required' })
                return
            }

            const keyword = await glossaryService.createKeyword({
                name: name.trim(),
                en_keyword: en_keyword || null,
                description: description || null,
                sort_order: sort_order || 0,
                is_active: is_active !== false,
                created_by: userId,
                updated_by: userId,
            })

            res.status(201).json(keyword)
        } catch (error: any) {
            console.error('Error creating glossary keyword:', error)
            if (error.message?.includes('unique') || error.code === '23505') {
                res.status(409).json({ error: 'Keyword name already exists' })
                return
            }
            res.status(500).json({ error: error.message || 'Failed to create keyword' })
        }
    }

    /**
     * PUT /glossary/keywords/:id — Update a keyword.
     */
    static async updateKeyword(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || null
            const id = req.params.id!
            const { name, en_keyword, description, sort_order, is_active } = req.body

            const updateData: Record<string, any> = { updated_by: userId }
            if (name !== undefined) updateData.name = name.trim()
            if (en_keyword !== undefined) updateData.en_keyword = en_keyword
            if (description !== undefined) updateData.description = description
            if (sort_order !== undefined) updateData.sort_order = sort_order
            if (is_active !== undefined) updateData.is_active = is_active

            const keyword = await glossaryService.updateKeyword(id, updateData)
            if (!keyword) {
                res.status(404).json({ error: 'Keyword not found' })
                return
            }

            res.json(keyword)
        } catch (error: any) {
            console.error('Error updating glossary keyword:', error)
            if (error.message?.includes('unique') || error.code === '23505') {
                res.status(409).json({ error: 'Keyword name already exists' })
                return
            }
            res.status(500).json({ error: error.message || 'Failed to update keyword' })
        }
    }

    /**
     * DELETE /glossary/keywords/:id — Delete a keyword.
     */
    static async deleteKeyword(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id!
            await glossaryService.deleteKeyword(id)
            res.status(204).send()
        } catch (error: any) {
            console.error('Error deleting glossary keyword:', error)
            res.status(500).json({ error: error.message || 'Failed to delete keyword' })
        }
    }

    // ========================================================================
    // Prompt Builder Endpoints
    // ========================================================================

    /**
     * GET /glossary/search — Search tasks and keywords by name.
     */
    static async search(req: Request, res: Response): Promise<void> {
        try {
            const query = (req.query.q as string) || ''
            if (!query.trim()) {
                res.json({ tasks: [], keywords: [] })
                return
            }
            const results = await glossaryService.search(query)
            res.json(results)
        } catch (error: any) {
            console.error('Error searching glossary:', error)
            res.status(500).json({ error: error.message || 'Failed to search glossary' })
        }
    }

    /**
     * POST /glossary/generate-prompt — Generate a prompt from task + keywords.
     */
    static async generatePrompt(req: Request, res: Response): Promise<void> {
        try {
            const { taskId, keywordIds } = req.body

            if (!taskId || !keywordIds || !Array.isArray(keywordIds)) {
                res.status(400).json({
                    error: 'taskId and keywordIds (array) are required',
                })
                return
            }

            const prompt = await glossaryService.generatePrompt(taskId, keywordIds)
            res.json({ prompt })
        } catch (error: any) {
            console.error('Error generating prompt:', error)
            res.status(500).json({ error: error.message || 'Failed to generate prompt' })
        }
    }

    /**
     * POST /glossary/bulk-import — Bulk import tasks from parsed Excel data.
     */
    static async bulkImport(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || undefined
            const { rows } = req.body

            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                res.status(400).json({ error: 'rows array is required and must not be empty' })
                return
            }

            const result = await glossaryService.bulkImport(rows, userId)
            res.json(result)
        } catch (error: any) {
            console.error('Error bulk importing glossary:', error)
            res.status(500).json({ error: error.message || 'Failed to bulk import' })
        }
    }

    /**
     * POST /glossary/keywords/bulk-import — Bulk import keywords from parsed Excel data.
     */
    static async bulkImportKeywords(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - userId from auth middleware
            const userId = req.user?.id || undefined
            const { rows } = req.body

            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                res.status(400).json({ error: 'rows array is required and must not be empty' })
                return
            }

            const result = await glossaryService.bulkImportKeywords(rows, userId)
            res.json(result)
        } catch (error: any) {
            console.error('Error bulk importing keywords:', error)
            res.status(500).json({ error: error.message || 'Failed to bulk import keywords' })
        }
    }
}
