
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { UserDismissedBroadcast } from './types.js';

export class UserDismissedBroadcastModel extends BaseModel<UserDismissedBroadcast> {
  protected tableName = 'user_dismissed_broadcasts';
  protected knex = db;
}
