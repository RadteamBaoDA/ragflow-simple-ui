/**
 * Routes for project search app API endpoints.
 * Nested under /api/projects/:projectId/searches.
 */
import { Router } from "express";
import { ProjectSearchController } from "@/modules/projects/project-search/project-search.controller.js";
import { requireAuth } from "@/shared/middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

// Search app CRUD
router.get("/", requireAuth, ProjectSearchController.list);
router.get("/:searchId", requireAuth, ProjectSearchController.getById);
router.post("/", requireAuth, ProjectSearchController.create);
router.put("/:searchId", requireAuth, ProjectSearchController.update);
router.delete("/:searchId", requireAuth, ProjectSearchController.remove);

// Sync from RAGFlow
router.post("/:searchId/sync", requireAuth, ProjectSearchController.sync);

export default router;
