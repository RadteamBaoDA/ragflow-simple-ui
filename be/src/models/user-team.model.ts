
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

export class UserTeamModel extends BaseModel<UserTeam> {
  protected tableName = 'user_teams'
  protected knex = db

  /**
   * Find all team IDs for a specific user.
   * Used for permission evaluation.
   */
  async findTeamsByUserId(userId: string): Promise<string[]> {
    const rows = await this.knex(this.tableName).select('team_id').where({ user_id: userId })
    return rows.map(r => r.team_id)
  }

  /**
   * Insert or update team membership (upsert).
   * Uses ON CONFLICT to handle existing memberships.
   */
  async upsert(userId: string, teamId: string, role: 'member' | 'leader' = 'member'): Promise<void> {
    await this.knex(this.tableName)
      .insert({ user_id: userId, team_id: teamId, role })
      .onConflict(['user_id', 'team_id'])
      .merge({ role })
  }

  /**
   * Delete a specific user-team membership.
   */
  async deleteByUserAndTeam(userId: string, teamId: string): Promise<void> {
    await this.knex(this.tableName)
      .where({ user_id: userId, team_id: teamId })
      .delete()
  }

  /**
   * Get all members of a team with user details.
   * Returns user info joined with membership role.
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
      .join('users', 'users.id', 'user_teams.user_id')
      .where('user_teams.team_id', teamId)
      .orderBy([
        { column: 'user_teams.role', order: 'desc' },
        { column: 'users.display_name', order: 'asc' }
      ])
  }

  /**
   * Get all teams for a user with team details.
   * Returns full team records.
   */
  async findTeamsWithDetailsByUserId(userId: string): Promise<Team[]> {
    return this.knex('teams')
      .select('teams.*')
      .join('user_teams', 'teams.id', 'user_teams.team_id')
      .where('user_teams.user_id', userId)
      .orderBy('teams.name', 'asc')
  }

  /**
   * Find users by array of IDs with their roles.
   * Used for batch operations.
   */
  async findUsersByIds(userIds: string[]): Promise<{ id: string, role: string }[]> {
    if (!userIds || userIds.length === 0) return []
    return this.knex('users')
      .select('id', 'role')
      .whereIn('id', userIds)
  }
}
