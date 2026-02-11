
import { Request, Response, NextFunction } from 'express'
import { config } from '@/shared/config/index.js'
import { log } from '@/shared/services/logger.service.js'

/**
 * Middleware to require an API key for external routes.
 *
 * Verifies that the 'x-api-key' header matches the configured external trace API key.
 * This is used to secure public-facing external endpoints.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireExternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key']

  if (!config.externalTrace.apiKey) {
    // If no API key is configured, allow all requests (or deny all depending on security policy)
    // Here we warn but allow, assuming it's intentional for development or open access
    // However, for security, let's deny if not configured in production
    if (config.isProduction) {
        log.error('External API Key is not configured in production.')
        res.status(500).json({ error: 'Server configuration error' })
        return;
    }
    next()
    return
  }

  if (apiKey !== config.externalTrace.apiKey) {
    log.warn('Invalid External API Key attempt', {
        ip: req.ip,
        path: req.path
    })
    res.status(401).json({ error: 'Invalid API Key' })
    return
  }

  next()
}
