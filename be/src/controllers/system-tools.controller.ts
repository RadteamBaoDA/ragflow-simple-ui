
import { Request, Response } from 'express';
import { systemToolsService } from '../services/system-tools.service.js';
import { log } from '../services/logger.service.js';

export class SystemToolsController {
  async getTools(req: Request, res: Response): Promise<void> {
    try {
        const tools = await systemToolsService.getTools();
        res.json(tools);
    } catch (error) {
        log.error('Failed to fetch system tools', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch system tools' });
    }
  }

  async runTool(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Tool ID is required' });
        return;
    }
    try {
        const result = await systemToolsService.runTool(id, req.body);
        res.json(result);
    } catch (error) {
        log.error('Failed to run system tool', { error: String(error) });
        res.status(500).json({ error: 'Failed to run system tool' });
    }
  }
}
