/**
 * @fileoverview Storage admin controller for raw bucket and service account operations.
 * @module controllers/storage-raw.controller
 * @description Provides direct access to storage buckets, stats, and service accounts.
 */
import { Request, Response } from 'express'
import { storageService } from '@/services/storage/index.js'
import { log } from '@/services/logger.service.js'

/**
 * StorageRawController
 * @description Raw storage admin controller for direct bucket/object operations.
 */
export class StorageRawController {
    /**
     * Get global storage metrics.
     */
    async getMetrics(req: Request, res: Response): Promise<void> {
        try {
            const stats = await storageService.getGlobalStats()
            res.json(stats)
        } catch (error) {
            log.error('Failed to get global metrics', { error })
            res.status(500).json({ error: 'Failed to fetch global metrics' })
        }
    }

    /**
     * List all buckets.
     */
    async listBuckets(req: Request, res: Response): Promise<void> {
        try {
            const buckets = await storageService.listBuckets()
            res.json({ buckets })
        } catch (error) {
            log.error('Failed to list buckets', { error: error instanceof Error ? error.message : String(error) })
            res.status(500).json({ error: 'Failed to list buckets' })
        }
    }

    /**
     * Get statistics for a specific bucket.
     */
    async getBucketStats(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' })
                return
            }
            const stats = await storageService.getBucketStats(name)
            res.json({ stats })
        } catch (error) {
            log.error('Failed to get bucket stats', { bucketName: req.params.name || 'unknown', error: error instanceof Error ? error.message : String(error) })
            res.status(500).json({ error: 'Failed to get bucket statistics' })
        }
    }

    /**
     * Create a new bucket.
     */
    async createBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' })
                return
            }

            const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{0,61}[a-z0-9]$/
            if (!bucketNameRegex.test(name) || name.length < 3) {
                res.status(400).json({ error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.' })
                return
            }

            await storageService.createBucket(name, req.user)
            res.status(201).json({ message: 'Bucket created successfully' })
        } catch (error) {
            log.error('Failed to create bucket', { bucketName: req.body?.name || 'unknown', error: error instanceof Error ? error.message : String(error) })
            res.status(500).json({ error: 'Failed to create bucket. It may already exist.' })
        }
    }

    /**
     * Delete a bucket.
     */
    async deleteBucket(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params
            if (!name) {
                res.status(400).json({ error: 'Bucket name is required' })
                return
            }
            await storageService.deleteBucket(name, req.user)
            res.json({ message: 'Bucket deleted successfully' })
        } catch (error) {
            log.error('Failed to delete bucket', { bucketName: req.params.name || 'unknown', error: error instanceof Error ? error.message : String(error) })
            res.status(500).json({ error: 'Failed to delete bucket. Ensure it is empty.' })
        }
    }

    /**
     * List all access keys.
     */
    async listKeys(req: Request, res: Response): Promise<void> {
        try {
            const keys = await storageService.listAccessKeys()
            res.json({ keys })
        } catch (error: any) {
            log.error('Failed to list access keys', { message: error.message, stack: error.stack })
            res.status(500).json({ error: 'Failed to list access keys' })
        }
    }

    /**
     * Create a new access key.
     */
    async createKey(req: Request, res: Response): Promise<void> {
        try {
            const { policy, name, description } = req.body
            const result = await storageService.createAccessKey(policy, name, description)
            res.json(result)
        } catch (error) {
            log.error('Failed to create access key', { error })
            res.status(500).json({ error: 'Failed to create access key' })
        }
    }

    /**
     * Delete an access key.
     */
    async deleteKey(req: Request, res: Response): Promise<void> {
        try {
            const { accessKey } = req.params
            if (!accessKey) {
                res.status(400).json({ error: 'Access Key is required' })
                return
            }
            await storageService.deleteAccessKey(accessKey)
            res.json({ message: 'Access key deleted successfully' })
        } catch (error) {
            log.error('Failed to delete access key', { error })
            res.status(500).json({ error: 'Failed to delete access key' })
        }
    }
}

