/**
 * @fileoverview Shared re-export of Converter Queue Service.
 * @description This file re-exports from the modules/converter location.
 * @module shared/services/converter-queue
 */
export {
  ConverterQueueService,
  converterQueueService,
  type ConversionJobStatus,
  type VersionJob,
  type FileTracking,
  type QueueStats,
  type JobListFilter,
} from "@/modules/converter/converter-queue.service.js";
