/**
 * @fileoverview Barrel file for the teams feature.
 * Exports page, types, and API for external consumption.
 * @module features/teams
 */

// Page
export { default as TeamManagementPage } from './pages/TeamManagementPage'

// Types
export type {
    Team,
    TeamMember,
    CreateTeamDTO,
    UpdateTeamDTO,
} from './types/team.types'

// API
export { teamApi } from './api/teamApi'
