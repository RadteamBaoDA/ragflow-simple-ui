
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { UserTeam } from './types.js';

export class UserTeamModel extends BaseModel<UserTeam> {
  protected tableName = 'user_teams';
  protected knex = db;
}
