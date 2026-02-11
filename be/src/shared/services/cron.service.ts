
// Schedules and runs recurring maintenance tasks like temp cache cleanup.
import cron from 'node-cron';
import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { config } from '@/shared/config/index.js';
import { log } from '@/shared/services/logger.service.js';

/**
 * CronService
 * Singleton service that schedules and runs recurring maintenance tasks.
 * Currently handles temp cache file cleanup based on configurable TTL and schedule.
 */
export class CronService {
    /**
     * Start the temp file cleanup cron job.
     * @returns void
     * @description Registers a scheduled task that periodically removes expired files from temp cache.
     */
    public startCleanupJob() {
        // Log startup configuration
        log.info('Starting temp file cleanup cron job', {
            schedule: config.tempFileCleanupSchedule,
            ttlMs: config.tempFileTTL,
            tempPath: config.tempCachePath
        });

        // Register the cleanup task with node-cron matches config schedule
        cron.schedule(config.tempFileCleanupSchedule, async () => {
            await this.runCleanup();
        });
    }

    /**
     * Execute the temp file cleanup process.
     * @returns Promise<void>
     * @description Scans the temp directory and deletes files older than the configured TTL.
     */
    private async runCleanup() {
        log.debug('Running scheduled temp file cleanup');
        const tempPath = config.tempCachePath;

        try {
            try {
                // Check if temp directory exists
                await fs.access(tempPath, constants.F_OK);
            } catch {
                log.warn('Temp directory does not exist, skipping cleanup', { tempPath });
                return;
            }

            // List all files in temp directory
            const files = await fs.readdir(tempPath);
            const now = Date.now();
            let deletedCount = 0;
            let errorCount = 0;

            // Iterate over each file to check age
            for (const file of files) {
                const filePath = path.join(tempPath, file);
                try {
                    // Get file stats to check modification time
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;

                    // If file is older than TTL, delete it
                    if (age > config.tempFileTTL) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        log.debug('Deleted expired temp file', { file, age });
                    }
                } catch (err) {
                    // Log error but continue with next file
                    errorCount++;
                    log.error('Error processing file during cleanup', { file, error: err });
                }
            }

            // Log summary of cleanup operation
            if (deletedCount > 0 || errorCount > 0) {
                log.info('Temp file cleanup completed', { deletedCount, errorCount, totalScanned: files.length });
            } else {
                log.debug('Temp file cleanup completed - no files expired');
            }

        } catch (error) {
            // Catch top-level errors in the cron job
            log.error('Critical error in temp file cleanup job', { error });
        }
    }
}

export const cronService = new CronService();
