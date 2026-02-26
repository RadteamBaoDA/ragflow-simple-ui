/**
 * External Search Routes
 * SDK-facing endpoints for CRUD operations on AI Search apps.
 * All routes are protected by external API key authentication.
 */
import { Router } from "express";
import { ExternalSearchController } from "@/modules/external/external-search.controller.js";
import { requireExternalApiKey } from "@/modules/external/middleware/auth-external.middleware.js";

const router = Router();
const controller = new ExternalSearchController();

/**
 * @route POST /api/external/search/create
 * @description Create a new AI Search app.
 * @access Private (External API Key required)
 */
// Create a new search app in RAGFlow
router.post(
  "/create",
  requireExternalApiKey,
  controller.create.bind(controller),
);

/**
 * @route POST /api/external/search/update
 * @description Update an existing AI Search app.
 * @access Private (External API Key required)
 */
// Update an existing search app in RAGFlow
router.post(
  "/update",
  requireExternalApiKey,
  controller.update.bind(controller),
);

/**
 * @route GET /api/external/search/detail
 * @description Get AI Search app detail by search_id query parameter.
 * @access Private (External API Key required)
 */
// Fetch search app detail from RAGFlow
router.get(
  "/detail",
  requireExternalApiKey,
  controller.detail.bind(controller),
);

/**
 * @route POST /api/external/search/list
 * @description List AI Search apps with optional filters.
 * @access Private (External API Key required)
 */
// List search apps from RAGFlow with pagination and filters
router.post("/list", requireExternalApiKey, controller.list.bind(controller));

/**
 * @route POST /api/external/search/rm
 * @description Delete an AI Search app.
 * @access Private (External API Key required)
 */
// Delete a search app from RAGFlow
router.post("/rm", requireExternalApiKey, controller.remove.bind(controller));

export default router;
