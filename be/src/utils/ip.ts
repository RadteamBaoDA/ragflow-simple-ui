import { Request } from 'express';

/**
 * Extracts the client's IP address from the request headers or socket.
 * Prioritizes 'X-Forwarded-For' and 'X-Real-IP' headers for proxied requests.
 *
 * @param req - The Express request object.
 * @returns The client IP address as a string, or 'unknown' if not found.
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
