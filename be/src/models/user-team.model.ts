
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { UserTeam } from '@/models/types.js';

export class UserTeamModel extends BaseModel<UserTeam> {
  protected tableName = 'user_teams';
  protected knex = db;
}
