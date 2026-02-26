/**
 * @fileoverview Routes for the converter module.
 * Mounted at /api/converter in the main route setup.
 *
 * @module modules/converter/converter.routes
 */
import { Router } from "express";
import { ConverterController } from "@/modules/converter/converter.controller.js";
import { requireAuth } from "@/shared/middleware/auth.middleware.js";

const router = Router();

// Version job listing and status
router.get("/jobs", requireAuth, ConverterController.listVersionJobs);
router.get(
  "/jobs/:jobId",
  requireAuth,
  ConverterController.getVersionJobStatus,
);
router.get(
  "/jobs/:jobId/files",
  requireAuth,
  ConverterController.getVersionJobFiles,
);

// Queue statistics
router.get("/stats", requireAuth, ConverterController.getStats);

// Schedule configuration
router.get("/config", requireAuth, ConverterController.getConfig);
router.put("/config", requireAuth, ConverterController.updateConfig);

// Manual trigger
router.post("/start", requireAuth, ConverterController.startManual);

// Upload completed conversions to RAGFlow
router.post("/upload", requireAuth, ConverterController.uploadCompleted);

export default router;
