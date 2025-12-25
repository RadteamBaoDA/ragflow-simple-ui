// Extracts client IP from common proxy headers with sane fallbacks.
import { Request } from 'express';

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For (nginx), X-Real-IP, then socket address.
 */
export function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    if (typeof realIp === 'string') {
        return realIp;
    }
    return req.socket.remoteAddress || 'unknown';
}
