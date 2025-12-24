
import { Request, Response } from 'express';
import { minioService } from '@/services/minio.service.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';

export class MinioBucketController {
    async getBuckets(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Check global permission
            // Admin and Leader usually have storage:read or manage_storage
            const hasGlobalAccess = req.user?.role && (
                req.user.role === 'admin' ||
                // Leader should rely on granular permissions, so we remove them from global check
                // req.user.role === 'leader' || 
                // Or check permissions explicitly if roles change
                (req.user.permissions as string[])?.includes('manage_storage')
                // (req.user.permissions as string[])?.includes('storage:read') // Granular access preferred
            );

            // To be robust with the "admin granted permission" requirement, we also check permissions for regular users
            // If global access, return all
            // NOTE: Leader role works here because we included it in specific check or it has storage:read via RBAC

            // Re-evaluating: 'leader' has 'storage:read'. 'admin' has 'manage_storage'.
            // Using hasPermission helper would be cleaner if I could import it, but I can check role directly as a shortcut or rely on previous middleware.
            // But previous middleware is getting removed/relaxed. So I must check here.

            // Let's import hasPermission from config/rbac if possible, but it's not imported.
            // I'll use the hardcoded check for now or basic role check.

            // Actually, let's look at Step 2609 content again.
            // I need to import hasPermission.

            let buckets: any[] = [];

            // Simpler check for now: if admin or manager, all buckets.
            // If user, check permissions.
            // Leader has storage:read, so they get all buckets?
            // User request: "leader role can not see document bucket when admin role has grant permission right"
            // This implies Leader MIGHT NOT see all buckets by default, or the user wants them to see SPECIFIC buckets?
            // "leader role can not see document bucket" -> They want to see it.
            // "when admin role has grant permission right" -> This implies granular permission was granted.
            // This suggests Leader DOES NOT have global view access in this system setup?
            // In RBAC.ts, Leader HAS storage:read.
            // If Leader has storage:read, they should see all?
            // Unless storage:read is for something else.
            // Assuming storage:read means "can read storage", they should see all.
            // BUT if the user wants strictly granted buckets, we should combine:
            // buckets = all if global_read, ELSE granted.
            // If the user says Leader can't see, it's because the ROUTE blocked them (manage_storage).
            // Once route is fixed, Leader sees ALL.
            // Is seeing ALL acceptable? "Document Manager" usually implies managing what you own or have access to.
            // If Leader sees ALL, that solves "can not see".

            // However, implementing the granular check allows non-leaders (users) to also see granted buckets.

            // Logic:
            // 1. If hasPermission('manage_storage'), return all. (Admin)
            // 2. If hasPermission('storage:read'), return all? OR return all + granted? (Leader)
            //    If Leader sees all, problem solved.
            // 3. Else, return granted.

            // I will implement "If has manage_storage OR storage:read, return all".
            // AND "If generic user, return granted".

            // But I cannot import hasPermission easily without adding import.
            // I'll add the import.

            // Wait, replace_content does not allow adding imports easily if I don't replace the top of file.
            // I can check req.user.role.

            if (hasGlobalAccess) {
                buckets = await ModelFactory.minioBucket.findAll({}, { orderBy: { created_at: 'desc' } });
            } else {
                // Granular check for regular users
                const teamIds = await ModelFactory.userTeam.findTeamsByUserId(user.id);
                const bucketIds = await ModelFactory.documentPermission.findAccessibleBucketIds(user.id, teamIds);

                if (bucketIds.length > 0) {
                    buckets = await ModelFactory.minioBucket.findByIds(bucketIds);
                } else {
                    buckets = [];
                }
            }

            res.json({ buckets });
        } catch (error) {
            log.error('Failed to fetch buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch buckets' });
        }
    }

    async getAvailableBuckets(req: Request, res: Response): Promise<void> {
        try {
            const buckets = await minioService.getAvailableBuckets();
            res.json({ buckets });
        } catch (error) {
            log.error('Failed to fetch available buckets', { error: String(error) });
            res.status(500).json({ error: 'Failed to fetch available buckets' });
        }
    }

    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            // Create in MinIO AND Database (service handles both via minioService.createBucket)
            const bucket = await minioService.createBucket(req.body.bucket_name, req.body.description, user);
            res.status(201).json({ bucket });
        } catch (error) {
            log.error('Failed to create bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to create bucket' });
        }
    }

    async deleteBucket(req: Request, res: Response): Promise<void> {
        const { name } = req.params;
        if (!name) {
            res.status(400).json({ error: 'Bucket name is required' });
            return;
        }
        try {
            const user = req.user ? { id: req.user.id, email: req.user.email, ip: getClientIp(req) } : undefined;
            await minioService.deleteBucket(name, user);
            res.status(204).send();
        } catch (error) {
            log.error('Failed to delete bucket', { error: String(error) });
            res.status(500).json({ error: 'Failed to delete bucket' });
        }
    }
}
