
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at?: Date;
    /** Timestamp of last update */
    updated_at?: Date;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
}

/**
 * SystemConfig interface representing key-value configuration pairs.
 */
export interface SystemConfig {
    /** Configuration key name */
    key: string;
    /** Configuration value */
    value: string;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at?: Date;
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
    /** Description of the source */
    description?: string | null;
    /** Share ID extracted from URL (shared_id param) */
    share_id?: string | null;
    /** URL for embedded chat widget on search page */
    chat_widget_url?: string | null;
    /** Access Control List details in JSON format */
    access_control: any;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
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

/**
 * Prompt interface representing a saved prompt.
 */
export interface Prompt {
    /** Unique UUID for the prompt */
    id: string;
    /** The prompt text */
    prompt: string;
    /** Description of the prompt */
    description?: string | null;
    /** Array of tags */
    tags: string[]; // Parsed from JSON
    /** Source of the prompt (e.g., 'chat') */
    source: string;
    /** Whether the prompt is active */
    is_active: boolean;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * PromptInteraction interface representing user feedback (Like, Dislike, Comment).
 */
export interface PromptInteraction {
    /** Unique UUID for the interaction */
    id: string;
    /** UUID of the prompt */
    prompt_id: string;
    /** User ID who provided the feedback */
    user_id?: string | null;
    /** Type of interaction ('like', 'dislike', 'comment') */
    interaction_type: 'like' | 'dislike' | 'comment';
    /** Comment text if type is 'comment' */
    comment?: string | null;
    /** Snapshot of the prompt text at the time of interaction */
    prompt_snapshot?: string | null;
    /** Timestamp of creation */
    created_at: Date;
}

/**
 * PromptTag interface representing a reusable tag with color.
 */
export interface PromptTag {
    /** Unique UUID for the tag */
    id: string;
    /** Tag name (unique) */
    name: string;
    /** Color in hex format (e.g., #FF5733) */
    color: string;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}
/**
 * PromptPermission interface representing a record in the 'prompt_permissions' table.
 */
export interface PromptPermission {
    /** Unique UUID for the permission record */
    id: string;
    /** Type of entity granted permission ('user' or 'team') */
    entity_type: string;
    /** UUID of the user or team */
    entity_id: string;
    /** Numeric permission level */
    permission_level: number;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * DTO for bulk creating prompts.
 */
export interface BulkCreatePromptDto {
    /** The prompt text (required) */
    prompt: string;
    /** Description of the prompt */
    description?: string | null;
    /** Array of tag names */
    tags?: string[];
    /** Source identifier */
    source?: string;
}

/**
 * Result of bulk prompt creation.
 */
export interface BulkCreateResult {
    /** Whether the operation completed successfully */
    success: boolean;
    /** Number of prompts successfully imported */
    imported: number;
    /** Number of prompts skipped (duplicates) */
    skipped: number;
    /** Any error messages */
    errors: string[];
}

/**
 * GlossaryTask interface representing a task in the glossary management system.
 * Tasks are the parent entity containing prompt template instructions.
 */
export interface GlossaryTask {
    /** Unique UUID for the task */
    id: string;
    /** Task name (unique) */
    name: string;
    /** Description of the task */
    description?: string | null;
    /** Task instruction in English (required) */
    task_instruction_en: string;
    /** Task instruction in Japanese (optional) */
    task_instruction_ja?: string | null;
    /** Task instruction in Vietnamese (optional) */
    task_instruction_vi?: string | null;
    /** Keyword and context template with {keyword} placeholder */
    context_template: string;
    /** Sort order for display */
    sort_order: number;
    /** Whether the task is active */
    is_active: boolean;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * GlossaryKeyword interface representing a standalone keyword entity.
 * Keywords are independent entries in the glossary system.
 */
export interface GlossaryKeyword {
    /** Unique UUID for the keyword */
    id: string;
    /** Keyword name (globally unique) */
    name: string;
    /** English translation of the keyword */
    en_keyword?: string | null;
    /** Description of the keyword */
    description?: string | null;
    /** Sort order for display */
    sort_order: number;
    /** Whether the keyword is active */
    is_active: boolean;
    /** User ID who created this record */
    created_by?: string | null;
    /** User ID who last updated this record */
    updated_by?: string | null;
    /** Timestamp of record creation */
    created_at: Date;
    /** Timestamp of last update */
    updated_at: Date;
}

/**
 * DTO for a single row in the glossary bulk import Excel file.
 */
export interface BulkImportGlossaryRow {
    /** Name of the task (required) */
    task_name: string;
    /** Task instruction in English (required) */
    task_instruction_en: string;
    /** Task instruction in Japanese (optional) */
    task_instruction_ja?: string;
    /** Task instruction in Vietnamese (optional) */
    task_instruction_vi?: string;
    /** Context template with {keyword} placeholder */
    context_template: string;
}

/**
 * Result of glossary bulk import operation.
 */
export interface BulkImportGlossaryResult {
    /** Whether the operation completed successfully */
    success: boolean;
    /** Number of tasks created */
    tasksCreated: number;
    /** Number of items skipped (duplicates) */
    skipped: number;
    /** Any error messages */
    errors: string[];
}
