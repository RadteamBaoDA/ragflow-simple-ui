/**
 * @fileoverview Type definitions for the Teams feature.
 * @module features/teams/types/team.types
 */

/**
 * Represents a Team entity.
 */
export interface Team {
    /** Unique team ID */
    id: string
    /** Team Display Name */
    name: string
    /** Optional project name associated with the team */
    project_name?: string
    /** Team description */
    description?: string
    /** ISO timestamp of creation */
    created_at: string
    /** ISO timestamp of last update */
    updated_at: string
    /** Number of members in the team */
    member_count?: number
    /** Team leader info */
    leader?: {
        id: string
        display_name: string
        email: string
    } | null
}

/**
 * Represents a member within a team.
 */
export interface TeamMember {
    /** Member's User ID */
    id: string
    /** Member's Email */
    email: string
    /** Member's Display Name */
    display_name: string
    /** Role within the team (member/leader) */
    role: 'member' | 'leader'
    /** ISO timestamp when user joined team */
    joined_at: string
}

/**
 * Payload for creating a new team.
 */
export interface CreateTeamDTO {
    name: string
    project_name?: string
    description?: string
}

/**
 * Payload for updating an existing team.
 */
export interface UpdateTeamDTO {
    name?: string
    project_name?: string
    description?: string
}
