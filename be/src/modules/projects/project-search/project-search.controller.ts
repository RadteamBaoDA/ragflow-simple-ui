/**
 * ProjectSearchController: Handles HTTP requests for project search apps.
 */
import { Request, Response } from "express";
import { projectSearchService } from "@/modules/projects/project-search/project-search.service.js";
import { ModelFactory } from "@/shared/models/factory.js";

/**
 * Controller for project search app API endpoints.
 */
export class ProjectSearchController {
  /**
   * List search apps for a project.
   * GET /api/projects/:projectId/searches
   */
  static async list(req: Request, res: Response) {
    try {
      const searches = await projectSearchService.listByProject(
        req.params.projectId as string,
      );
      res.json(searches);
    } catch (error) {
      console.error("Error listing project searches:", error);
      res.status(500).json({ error: "Failed to list search apps" });
    }
  }

  /**
   * Get a single search app.
   * GET /api/projects/:projectId/searches/:searchId
   */
  static async getById(req: Request, res: Response) {
    try {
      const search = await projectSearchService.getById(
        req.params.searchId as string,
      );
      if (!search) {
        res.status(404).json({ error: "Search app not found" });
        return;
      }
      res.json(search);
    } catch (error) {
      console.error("Error getting project search:", error);
      res.status(500).json({ error: "Failed to get search app" });
    }
  }

  /**
   * Create a new search app.
   * POST /api/projects/:projectId/searches
   */
  static async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        dataset_ids,
        ragflow_dataset_ids,
        search_config,
      } = req.body;
      if (!name) {
        res.status(400).json({ error: "Search app name is required" });
        return;
      }

      // Resolve project's RAGFlow server
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const search = await projectSearchService.create(
        {
          project_id: req.params.projectId as string,
          name,
          description,
          dataset_ids,
          ragflow_dataset_ids,
          search_config,
        },
        project.ragflow_server_id,
        userId,
        actor,
      );
      res.status(201).json(search);
    } catch (error: any) {
      console.error("Error creating project search:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create search app" });
    }
  }

  /**
   * Update a search app.
   * PUT /api/projects/:projectId/searches/:searchId
   */
  static async update(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const search = await projectSearchService.update(
        req.params.searchId as string,
        req.body,
        project.ragflow_server_id,
        userId,
        actor,
      );
      res.json(search);
    } catch (error: any) {
      console.error("Error updating project search:", error);
      if (error.message === "Search app not found") {
        res.status(404).json({ error: "Search app not found" });
        return;
      }
      res
        .status(500)
        .json({ error: error.message || "Failed to update search app" });
    }
  }

  /**
   * Delete a search app.
   * DELETE /api/projects/:projectId/searches/:searchId
   */
  static async remove(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      await projectSearchService.remove(
        req.params.searchId as string,
        project?.ragflow_server_id || undefined,
        actor,
      );
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting project search:", error);
      if (error.message === "Search app not found") {
        res.status(404).json({ error: "Search app not found" });
        return;
      }
      res.status(500).json({ error: "Failed to delete search app" });
    }
  }

  /**
   * Sync a search app from RAGFlow.
   * POST /api/projects/:projectId/searches/:searchId/sync
   */
  static async sync(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }
      const search = await projectSearchService.sync(
        req.params.searchId as string,
        project.ragflow_server_id,
      );
      res.json(search);
    } catch (error: any) {
      console.error("Error syncing project search:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to sync search app" });
    }
  }
}
