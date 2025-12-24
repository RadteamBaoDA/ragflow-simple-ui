
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { Team } from '@/models/types.js';

export class TeamModel extends BaseModel<Team> {
  protected tableName = 'teams';
  protected knex = db;
}
