
/**
 * Shared model types (DB rows). Keep aligned with migrations and services.
 * Defines the shape of data returned from database queries.
 */

/**
 * User interface representing a record in the 'users' table.
 */
export interface User {
    /** Unique UUID for the user */
    id: string;
    /** User's email address (unique) */
    email: string;
    /** User's display name */
    display_name: string;
    /** 
     * Optional alias for compatibility with Azure AD profile mapping
     * @deprecated Use display_name instead
     */
    displayName?: string | undefined;
    /** User's system role (e.g., 'admin', 'user', 'leader') */
    role: string;
    /** 
     * User's specific permissions.
     * Can be a JSON string when direct from DB or parsed array in application.
     */
    permissions: string | string[];
    /** Department name from Azure AD */
    department?: string | null;
    /** Job title from Azure AD */
    job_title?: string | null;
    /** Mobile phone number from Azure AD */
    mobile_phone?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
    /** Base64 encoded avatar image or URL */
    avatar?: string | undefined;
}

/**
 * Team interface representing a record in the 'teams' table.
 */
export interface Team {
    /** Unique UUID for the team */
    id: string;
    /** Name of the team */
    name: string;
    /** Optional project name associated with the team */
    project_name?: string | null;
    /** Description of the team's purpose */
    description?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * UserTeam interface representing the many-to-many relationship
 * between Users and Teams in the 'user_teams' table.
 */
export interface UserTeam {
    /** UUID of the user */
    user_id: string;
    /** UUID of the team */
    team_id: string;
    /** Role within the team (e.g., 'leader', 'member') */
    role: string;
    /** Timestamp when user joined the team */
    joined_at: Date;
}

/**
 * ChatSession interface representing a conversation session.
 */
export interface ChatSession {
    /** Unique UUID for the session */
    id: string;
    /** UUID of the user who owns the session */
    user_id: string;
    /** Title of the chat session, usually generated from first prompt */
    title: string;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * ChatMessage interface representing an individual message in a session.
 */
export interface ChatMessage {
    /** Unique UUID for the message */
    id: string;
    /** UUID of the session this message belongs to */
    session_id: string;
    /** Role of the message sender ('user' or 'assistant') */
    role: string;
    /** Content of the message */
    content: string;
    /** Timestamp when the message was created */
    timestamp: Date;
}

/**
 * MinioBucket interface representing a managed MinIO bucket.
 */
export interface MinioBucket {
    /** Unique UUID for the bucket record */
    id: string;
    /** Actual bucket name in MinIO */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Description of the bucket's contents */
    description?: string | null;
    /** UUID of the user who created the bucket */
    created_by: string;
    /** Timestamp of record creation */
    created_at: Date;
    /** Flag indicating if the bucket is active (1) or not (0) */
    is_active: number;
}

/**
 * SystemConfig interface representing key-value configuration pairs.
 */
export interface SystemConfig {
    /** Configuration key name */
    key: string;
    /** Configuration value */
    value: string;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * KnowledgeBaseSource interface representing a data source for RAG.
 */
export interface KnowledgeBaseSource {
    /** Unique UUID for the source */
    id: string;
    /** Type of source (e.g., 'minio', 'web') */
    type: string;
    /** Name of the source */
    name: string;
    /** URL or path to the source data */
    url: string;
    /** Access Control List details in JSON format */
    access_control: any;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * AuditLog interface representing a system audit event.
 */
export interface AuditLog {
    /** Auto-incrementing integer ID */
    id: number;
    /** UUID of the user who performed the action (nullable for system actions) */
    user_id?: string | null;
    /** Email of the user who performed the action */
    user_email: string;
    /** Action performed (e.g., 'CREATE', 'DELETE') */
    action: string;
    /** Type of resource affected (e.g., 'USER', 'FILE') */
    resource_type: string;
    /** ID of the affected resource (optional) */
    resource_id?: string | null;
    /** Additional details in JSON format */
    details: any;
    /** IP address of the client */
    ip_address?: string | null;
    /** Timestamp when the action occurred */
    created_at: Date;
}

/**
 * UserIpHistory interface representing IP tracking records.
 */
export interface UserIpHistory {
    /** Auto-incrementing integer ID */
    id: number;
    /** UUID of the user */
    user_id: string;
    /** IP address string */
    ip_address: string;
    /** Timestamp of last access from this IP */
    last_accessed_at: Date;
}

/**
 * DocumentPermission interface representing fine-grained access control.
 */
export interface DocumentPermission {
    /** Unique UUID for the permission record */
    id: string;
    /** Type of entity granted permission ('user' or 'team') */
    entity_type: string;
    /** UUID of the user or team */
    entity_id: string;
    /** UUID of the MinIO bucket */
    bucket_id: string;
    /** Numeric permission level */
    permission_level: number;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * BroadcastMessage interface representing system-wide alerts.
 */
export interface BroadcastMessage {
    /** Unique UUID for the message */
    id: string;
    /** Content of the broadcast message */
    message: string;
    /** Timestamp when validity starts */
    starts_at: Date;
    /** Timestamp when validity ends */
    ends_at: Date;
    /** CSS color for the banner background */
    color?: string | null;
    /** CSS color for the text */
    font_color?: string | null;
    /** Whether the message is currently active */
    is_active: boolean;
    /** Whether users can dismiss this message */
    is_dismissible: boolean;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * UserDismissedBroadcast interface tracking dismissed messages.
 */
export interface UserDismissedBroadcast {
    /** UUID of the user */
    user_id: string;
    /** UUID of the dismissed broadcast message */
    broadcast_id: string;
    /** Timestamp when it was dismissed */
    dismissed_at: Date;
}

/**
 * PermissionLevels enum defining access hierarchy.
 */
export enum PermissionLevel {
    /** No access */
    NONE = 0,
    /** Read-only access */
    VIEW = 1,
    /** Write/Upload access */
    UPLOAD = 2,
    /** Full control (including delete) */
    FULL = 3
}
