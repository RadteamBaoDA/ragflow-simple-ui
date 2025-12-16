/**
 * @fileoverview Routes for file preview caching.
 * 
 * Exposes a GET endpoint to retrieve files for preview.
 * URL: /api/preview/:bucketId/*
 * 
 * @module routes/preview
 */

import { Router, Request, Response } from 'express';
import { previewService } from '../services/preview.service.js';
import { log } from '../services/logger.service.js';
import mime from 'mime-types';

const router = Router();

/**
 * GET /:bucketId/*
 * Get a file stream for preview.
 * The wildcard * captures the full file path including slashes.
 */
router.get('/:bucketId/*', async (req: Request, res: Response) => {
    const { bucketId } = req.params;
    // req.params[0] contains the wildcard match (file path)
    const filePath = req.params[0];

    if (!bucketId || !filePath) {
        res.status(400).json({ error: 'Missing bucketId or filePath' });
        return;
    }

    try {
        const { path: localPath, filename } = await previewService.getPreviewStream(bucketId, filePath);

        // Determine content type
        const contentType = mime.lookup(filename) || 'application/octet-stream';

        // Sanitize filename for Content-Disposition header
        // Supports Unicode filenames (Japanese, Chinese, Vietnamese, etc.) via RFC 5987
        // 1. ASCII fallback: replace non-ASCII and control chars, escape quotes/backslashes
        const sanitizedFilename = filename
            .replace(/[^\x20-\x7E]/g, '_')  // Replace non-ASCII with underscore
            .replace(/["\\\r\n]/g, '_');     // Replace quotes, backslashes, newlines
        
        // 2. RFC 5987 filename*: UTF-8 percent-encoded for full Unicode support
        const encodedFilename = encodeURIComponent(filename)
            .replace(/'/g, '%27');  // Also encode single quotes for safety
        
        // Build Content-Disposition with both filename (ASCII fallback) and filename* (UTF-8)
        // Modern browsers prefer filename* and will display Unicode correctly
        const contentDisposition = `inline; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`;

        // Remove restrictive headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');

        // Send file using express helper which handles Ranges, caching, ETag, etc.
        res.sendFile(localPath, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': contentDisposition
            }
        }, (err) => {
            if (err) {
                // Response might have partially sent, so check headersSent
                console.error('Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to send file' });
                }
            }
        });

    } catch (error) {
        log.error('Failed to get preview', { bucketId, filePath, error });
        if ((error as any).code === 'NoSuchKey' || (error as any).code === 'NotFound') {
            if (!res.headersSent) res.status(404).json({ error: 'File not found' });
        } else {
            if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
        }
    }
});

export default router;
