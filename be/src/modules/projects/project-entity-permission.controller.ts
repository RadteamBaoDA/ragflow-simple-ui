/**
 * ProjectEntityPermissionController: Handles HTTP requests for per-entity permissions.
 *
 * @description REST endpoints for granular permission management.
 */
import { Request, Response } from "express";
import { projectEntityPermissionService } from "@/modules/projects/project-entity-permission.service.js";

/**
 * Controller class for entity permission API endpoints.
 */
export class ProjectEntityPermissionController {
  /**
   * List all entity permissions for a project.
   * GET /api/projects/:id/entity-permissions
   */
  static async list(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: "Project ID is required" });
        return;
      }
      const permissions = await projectEntityPermissionService.listByProject(
        req.params.id,
      );
      res.json(permissions);
    } catch (error) {
      console.error("Error listing entity permissions:", error);
      res.status(500).json({ error: "Failed to list entity permissions" });
    }
  }

  /**
   * List permissions for a specific entity.
   * GET /api/projects/:id/entity-permissions/:entityType/:entityId
   */
  static async listByEntity(req: Request, res: Response) {
    try {
      const { entityType, entityId } = req.params;
      if (!entityType || !entityId) {
        res.status(400).json({ error: "entityType and entityId are required" });
        return;
      }
      const permissions = await projectEntityPermissionService.listByEntity(
        entityType,
        entityId,
      );
      res.json(permissions);
    } catch (error) {
      console.error("Error listing entity permissions:", error);
      res.status(500).json({ error: "Failed to list entity permissions" });
    }
  }

  /**
   * Set (upsert) a permission for a grantee on an entity.
   * POST /api/projects/:id/entity-permissions
   */
  static async setPermission(req: Request, res: Response) {
    try {
      const {
        entity_type,
        entity_id,
        grantee_type,
        grantee_id,
        permission_level,
      } = req.body;

      // Validate required fields
      if (
        !entity_type ||
        !entity_id ||
        !grantee_type ||
        !grantee_id ||
        !permission_level
      ) {
        res.status(400).json({
          error:
            "entity_type, entity_id, grantee_type, grantee_id, and permission_level are required",
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!req.params.id) {
        res.status(400).json({ error: "Project ID is required" });
        return;
      }

      const actor = {
        id: req.user.id,
        email: req.user.email,
        ip: req.ip,
      };
      const permission = await projectEntityPermissionService.setPermission(
        {
          project_id: req.params.id,
          entity_type,
          entity_id,
          grantee_type,
          grantee_id,
          permission_level,
        },
        actor,
      );
      res.json(permission);
    } catch (error: any) {
      console.error("Error setting entity permission:", error);
      if (error.message?.startsWith("Invalid permission level")) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to set entity permission" });
    }
  }

  /**
   * Remove a permission.
   * DELETE /api/projects/:id/entity-permissions/:permId
   */
  static async removePermission(req: Request, res: Response) {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: "Project ID is required" });
        return;
      }
      if (!req.params.permId) {
        res.status(400).json({ error: "Permission ID is required" });
        return;
      }
      const actor = req.user
        ? { id: req.user.id, email: req.user.email, ip: req.ip }
        : undefined;
      await projectEntityPermissionService.removePermission(
        req.params.permId,
        actor,
      );
      res.status(204).send();
    } catch (error) {
      console.error("Error removing entity permission:", error);
      res.status(500).json({ error: "Failed to remove entity permission" });
    }
  }
}
