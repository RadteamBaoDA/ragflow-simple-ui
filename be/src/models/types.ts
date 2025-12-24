
export interface User {
    id: string;
    email: string;
    display_name: string;
    displayName?: string | undefined; // Add alias for compatibility, allow undefined explicitly
    role: string;
    permissions: string | string[]; // Can be string (JSON) or parsed array
    department?: string | null;
    job_title?: string | null;
    mobile_phone?: string | null;
    created_at: Date;
    updated_at: Date;
    avatar?: string | undefined; // Allow explicit undefined
}

export interface Team {
    id: string;
    name: string;
    project_name?: string | null;
    description?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface UserTeam {
    user_id: string;
    team_id: string;
    role: string;
    joined_at: Date;
}

export interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    role: string;
    content: string;
    timestamp: Date;
}

export interface MinioBucket {
    id: string;
    bucket_name: string;
    display_name: string;
    description?: string | null;
    created_by: string;
    created_at: Date;
    is_active: number;
}

export interface SystemConfig {
    key: string;
    value: string;
    updated_at: Date;
}

export interface KnowledgeBaseSource {
    id: string;
    type: string;
    name: string;
    url: string;
    access_control: any; // JSON
    created_at: Date;
    updated_at: Date;
}

export interface AuditLog {
    id: number;
    user_id?: string | null;
    user_email: string;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    details: any; // JSON
    ip_address?: string | null;
    created_at: Date;
}

export interface UserIpHistory {
    id: number;
    user_id: string;
    ip_address: string;
    last_accessed_at: Date;
}

export interface DocumentPermission {
    id: string;
    entity_type: string;
    entity_id: string;
    bucket_id: string;
    permission_level: number;
    created_at: Date;
    updated_at: Date;
}

export interface BroadcastMessage {
    id: string;
    message: string;
    starts_at: Date;
    ends_at: Date;
    color?: string | null;
    font_color?: string | null;
    is_active: boolean;
    is_dismissible: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface UserDismissedBroadcast {
    user_id: string;
    broadcast_id: string;
    dismissed_at: Date;
}

export enum PermissionLevel {
    NONE = 0,
    VIEW = 1,
    UPLOAD = 2,
    FULL = 3
}
