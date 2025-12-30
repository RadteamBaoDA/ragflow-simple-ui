
/**
 * User-team join model: resolves team ids per user for permission evaluation.
 * 
 * Extended with custom methods for complex queries used by team.service.ts:
 * - upsert: Insert or update team membership
 * - deleteByUserAndTeam: Remove specific membership
 * - findMembersByTeamId: Get users with join to users table
 * - findTeamsWithDetailsByUserId: Get teams with join to teams table
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { UserTeam, User, Team } from '@/models/types.js'

/**
 * Extended user info returned when fetching team members.
 */
export interface TeamMemberInfo {
  id: string
  email: string
  display_name: string
  role: string
  joined_at: Date
}

/**
 * UserTeamModel
 * Manages the many-to-many relationship between Users and Teams.
 * Handles membership roles and team associations.
 */
export class UserTeamModel extends BaseModel<UserTeam> {
  /** Table name in the database */
  protected tableName = 'user_teams'
  /** Knex connection instance */
  protected knex = db

  /**
   * Find all team IDs for a specific user.
   * Used for permission evaluation.
   * @param userId - ID of the user to look up
   * @returns Promise<string[]> - Array of team IDs the user belongs to
   * @description Simple SELECT query to get a list of team IDs.
   */
  async findTeamsByUserId(userId: string): Promise<string[]> {
    // Select only team_id column for matching user_id
    const rows = await this.knex(this.tableName).select('team_id').where({ user_id: userId })
    // Map result rows to simple array of strings
    return rows.map(r => r.team_id)
  }

  /**
   * Insert or update team membership (upsert).
   * Uses ON CONFLICT to handle existing memberships.
   * @param userId - ID of the user
   * @param teamId - ID of the team
   * @param role - Role in the team ('member' or 'leader')
   * @returns Promise<void>
   * @description Uses PostgreSQL ON CONFLICT clause to update role if membership exists, otherwise inserts new.
   */
  async upsert(userId: string, teamId: string, role: 'member' | 'leader' = 'member', _actorId?: string): Promise<void> {
    // Perform upsert (user_teams table only has: user_id, team_id, role, joined_at)
    await this.knex(this.tableName)
      .insert({
        user_id: userId,
        team_id: teamId,
        role
      }) // Try to insert
      .onConflict(['user_id', 'team_id']) // Check for unique constraint violation
      .merge({
        role
      }) // Update role if conflict occurs
  }

  /**
   * Delete a specific user-team membership.
   * @param userId - ID of the user
   * @param teamId - ID of the team
   * @returns Promise<void>
   * @description Removes the specific join record for user and team.
   */
  async deleteByUserAndTeam(userId: string, teamId: string): Promise<void> {
    // Delete record matching both user_id and team_id
    await this.knex(this.tableName)
      .where({ user_id: userId, team_id: teamId })
      .delete()
  }

  /**
   * Get all members of a team with user details.
   * Returns user info joined with membership role.
   * @param teamId - ID of the team to list members for
   * @returns Promise<TeamMemberInfo[]> - List of members with user details and role
   * @description Joins user_teams with users table to get display names and emails.
   */
  async findMembersByTeamId(teamId: string): Promise<TeamMemberInfo[]> {
    return this.knex(this.tableName)
      .select(
        'users.id',
        'users.email',
        'users.display_name',
        'user_teams.role',
        'user_teams.joined_at'
      )
      // Join with users table
      .join('users', 'users.id', 'user_teams.user_id')
      // Filter by team ID in the join table
      .where('user_teams.team_id', teamId)
      // Sort by role (Leaders first) then name
      .orderBy([
        { column: 'user_teams.role', order: 'desc' },
        { column: 'users.display_name', order: 'asc' }
      ])
  }

  /**
   * Get all teams for a user with team details.
   * Returns full team records.
   * @param userId - ID of the user
   * @returns Promise<Team[]> - List of teams the user belongs to
   * @description Joins teams with user_teams to find teams associated with the user.
   */
  async findTeamsWithDetailsByUserId(userId: string): Promise<Team[]> {
    return this.knex('teams')
      .select('teams.*')
      // Join teams with user_teams
      .join('user_teams', 'teams.id', 'user_teams.team_id')
      // Filter by user ID in the join table
      .where('user_teams.user_id', userId)
      // Sort alphabetically by team name
      .orderBy('teams.name', 'asc')
  }

  /**
   * Find users by array of IDs with their roles.
   * Used for batch operations.
   * @param userIds - Array of user IDs to look up
   * @returns Promise<{ id: string, role: string }[]> - List of users with IDs and roles
   * @description Helper query to fetch roles for specific users.
   */
  async findUsersByIds(userIds: string[]): Promise<{ id: string, role: string }[]> {
    // Return empty array if input is empty
    if (!userIds || userIds.length === 0) return []

    // Select id and role for given user IDs
    return this.knex('users')
      .select('id', 'role')
      .whereIn('id', userIds)
  }
}
