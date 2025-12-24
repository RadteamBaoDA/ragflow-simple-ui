
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { UserTeam } from '@/models/types.js';

export class UserTeamModel extends BaseModel<UserTeam> {
  protected tableName = 'user_teams';
  protected knex = db;
  async findTeamsByUserId(userId: string): Promise<string[]> {
    const rows = await this.knex(this.tableName).select('team_id').where({ user_id: userId });
    return rows.map(r => r.team_id);
  }
}
