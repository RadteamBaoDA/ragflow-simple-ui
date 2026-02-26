/**
 * External Search Controller
 * Handles incoming requests for external AI Search CRUD operations.
 */
import { Request, Response } from "express";
import { externalSearchService } from "@/modules/external/external-search.service.js";
import { log } from "@/shared/services/logger.service.js";

/**
 * Controller for external AI Search SDK endpoints.
 * Each method validates input, delegates to service, and returns JSON.
 */
export class ExternalSearchController {
  /**
   * Create a new AI Search app.
   * @param req - Express request with body { name, description?, server_id? }
   * @param res - Express response
   * @returns Promise<void>
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      // Debug log incoming request
      log.debug("External Search Create Request", { body: req.body });
      const { name, description, server_id } = req.body;

      // Validate required fields
      if (!name || typeof name !== "string" || name.trim() === "") {
        log.warn("External Search Create: Missing or invalid name", {
          body: req.body,
        });
        res
          .status(400)
          .json({ error: "Missing or invalid required field: name" });
        return;
      }

      // Create search app via service
      const result = await externalSearchService.createSearchApp({
        name: name.trim(),
        description,
        server_id,
      });

      log.debug("External Search Create Success", { result });
      res.status(201).json({
        code: 0,
        message: "Search app created successfully",
        data: result,
      });
    } catch (error) {
      // Log error and return appropriate status
      log.error("Error creating search app", error as Record<string, unknown>);
      const message = (error as Error).message || "Internal server error";
      res.status(500).json({ error: message });
    }
  }

  /**
   * Update an existing AI Search app.
   * @param req - Express request with body { search_id, name, tenant_id, search_config?, description?, server_id? }
   * @param res - Express response
   * @returns Promise<void>
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      // Debug log incoming request
      log.debug("External Search Update Request", { body: req.body });
      const { search_id, name, search_config, description, server_id } =
        req.body;

      // Validate required fields
      if (!search_id) {
        log.warn("External Search Update: Missing required field search_id", {
          body: req.body,
        });
        res.status(400).json({
          error: "Missing required field: search_id",
        });
        return;
      }

      // Update search app via service
      const result = await externalSearchService.updateSearchApp({
        search_id,
        name,
        search_config,
        description,
        server_id,
      });

      log.debug("External Search Update Success", { result });
      res.status(200).json({
        code: 0,
        message: "Search app updated successfully",
        data: result,
      });
    } catch (error) {
      // Log error and return appropriate status
      log.error("Error updating search app", error as Record<string, unknown>);
      const message = (error as Error).message || "Internal server error";
      res.status(500).json({ error: message });
    }
  }

  /**
   * Get AI Search app detail.
   * @param req - Express request with query { search_id, server_id? }
   * @param res - Express response
   * @returns Promise<void>
   */
  async detail(req: Request, res: Response): Promise<void> {
    try {
      // Debug log incoming request
      log.debug("External Search Detail Request", { query: req.query });
      const search_id = req.query.search_id as string;
      const server_id = req.query.server_id as string | undefined;

      // Validate required field
      if (!search_id) {
        log.warn("External Search Detail: Missing search_id", {
          query: req.query,
        });
        res
          .status(400)
          .json({ error: "Missing required query parameter: search_id" });
        return;
      }

      // Get search app detail via service
      const result = await externalSearchService.getSearchAppDetail(
        server_id,
        search_id,
      );

      log.debug("External Search Detail Success", { searchId: search_id });
      res.status(200).json({ code: 0, message: "success", data: result });
    } catch (error) {
      // Log error and return appropriate status
      log.error(
        "Error fetching search app detail",
        error as Record<string, unknown>,
      );
      const message = (error as Error).message || "Internal server error";
      res.status(500).json({ error: message });
    }
  }

  /**
   * List AI Search apps.
   * @param req - Express request with body { keywords?, page?, page_size?, orderby?, desc?, owner_ids?, server_id? }
   * @param res - Express response
   * @returns Promise<void>
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      // Debug log incoming request
      log.debug("External Search List Request", {
        body: req.body,
        query: req.query,
      });

      // Merge query params and body for flexibility
      const keywords = (req.query.keywords as string) || req.body.keywords;
      const page = Number(req.query.page || req.body.page) || undefined;
      const page_size =
        Number(req.query.page_size || req.body.page_size) || undefined;
      const orderby = (req.query.orderby as string) || req.body.orderby;
      const desc =
        req.query.desc !== undefined
          ? req.query.desc !== "false"
          : req.body.desc;
      const owner_ids = req.body.owner_ids || [];
      const server_id = req.body.server_id;

      // List search apps via service
      const result = await externalSearchService.listSearchApps({
        keywords,
        page,
        page_size,
        orderby,
        desc,
        owner_ids,
        server_id,
      } as Parameters<typeof externalSearchService.listSearchApps>[0]);

      log.debug("External Search List Success");
      res.status(200).json({ code: 0, message: "success", data: result });
    } catch (error) {
      // Log error and return appropriate status
      log.error("Error listing search apps", error as Record<string, unknown>);
      const message = (error as Error).message || "Internal server error";
      res.status(500).json({ error: message });
    }
  }

  /**
   * Delete an AI Search app.
   * @param req - Express request with body { search_id, server_id? }
   * @param res - Express response
   * @returns Promise<void>
   */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      // Debug log incoming request
      log.debug("External Search Remove Request", { body: req.body });
      const { search_id, server_id } = req.body;

      // Validate required field
      if (!search_id) {
        log.warn("External Search Remove: Missing search_id", {
          body: req.body,
        });
        res.status(400).json({ error: "Missing required field: search_id" });
        return;
      }

      // Delete search app via service
      const result = await externalSearchService.deleteSearchApp(
        server_id,
        search_id,
      );

      log.debug("External Search Remove Success", { searchId: search_id });
      res.status(200).json({
        code: 0,
        message: "Search app deleted successfully",
        data: result,
      });
    } catch (error) {
      // Log error and return appropriate status
      log.error("Error deleting search app", error as Record<string, unknown>);
      const message = (error as Error).message || "Internal server error";
      res.status(500).json({ error: message });
    }
  }
}
