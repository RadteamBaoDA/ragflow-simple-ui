/**
 * @fileoverview Type definitions for the Users feature.
 * @module features/users/types/user.types
 */

/**
 * User IP history record from the backend.
 */
export interface UserIpHistory {
    /** Record ID */
    id: number
    /** User ID this record belongs to */
    user_id: string
    /** IP address used for access */
    ip_address: string
    /** ISO timestamp of last access from this IP */
    last_accessed_at: string
}

/**
 * Map of user ID to their IP history records.
 */
export type IpHistoryMap = Record<string, UserIpHistory[]>
