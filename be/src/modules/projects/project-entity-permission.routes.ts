/**
 * Routes for per-entity permission management.
 *
 * @description Mounts entity permission CRUD endpoints under /api/projects/:id/entity-permissions.
 */
import { Router } from "express";
import { ProjectEntityPermissionController } from "./project-entity-permission.controller.js";

const router = Router({ mergeParams: true });

// GET /api/projects/:id/entity-permissions — list all entity permissions for a project
router.get("/", ProjectEntityPermissionController.list);

// GET /api/projects/:id/entity-permissions/:entityType/:entityId — list for one entity
router.get(
  "/:entityType/:entityId",
  ProjectEntityPermissionController.listByEntity,
);

// POST /api/projects/:id/entity-permissions — upsert a permission
router.post("/", ProjectEntityPermissionController.setPermission);

// DELETE /api/projects/:id/entity-permissions/:permId — remove a permission
router.delete("/:permId", ProjectEntityPermissionController.removePermission);

export default router;
