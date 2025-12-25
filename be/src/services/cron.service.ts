// Schedules and runs recurring maintenance tasks like temp cache cleanup.
import cron from 'node-cron';
import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';

/**
 * CronService
 * Singleton service that schedules and runs recurring maintenance tasks.
 * Currently handles temp cache file cleanup based on configurable TTL and schedule.
 */
export class CronService {
    /**
     * Start the temp file cleanup cron job.
     * Registers a scheduled task that periodically removes expired files from temp cache.
     * Schedule and TTL are configured via config.tempFileCleanupSchedule and config.tempFileTTL.
     */
    public startCleanupJob() {
        log.info('Starting temp file cleanup cron job', {
            schedule: config.tempFileCleanupSchedule,
            ttlMs: config.tempFileTTL,
            tempPath: config.tempCachePath
        });

        // Schedule the cleanup task
        cron.schedule(config.tempFileCleanupSchedule, async () => {
            await this.runCleanup();
        });
    }

    /**
     * Execute the temp file cleanup process.
     * Scans the temp directory and deletes files older than the configured TTL.
     * Logs deleted count, error count, and total scanned for observability.
     * Handles missing directory gracefully by skipping cleanup.
     */
    private async runCleanup() {
        log.debug('Running scheduled temp file cleanup');
        const tempPath = config.tempCachePath;

        try {
            try {
                await fs.access(tempPath, constants.F_OK);
            } catch {
                log.warn('Temp directory does not exist, skipping cleanup', { tempPath });
                return;
            }

            const files = await fs.readdir(tempPath);
            const now = Date.now();
            let deletedCount = 0;
            let errorCount = 0;

            for (const file of files) {
                const filePath = path.join(tempPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > config.tempFileTTL) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        log.debug('Deleted expired temp file', { file, age });
                    }
                } catch (err) {
                    errorCount++;
                    log.error('Error processing file during cleanup', { file, error: err });
                }
            }

            if (deletedCount > 0 || errorCount > 0) {
                log.info('Temp file cleanup completed', { deletedCount, errorCount, totalScanned: files.length });
            } else {
                log.debug('Temp file cleanup completed - no files expired');
            }

        } catch (error) {
            log.error('Critical error in temp file cleanup job', { error });
        }
    }
}

export const cronService = new CronService();
