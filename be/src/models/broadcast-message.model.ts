
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { BroadcastMessage } from './types.js';

export class BroadcastMessageModel extends BaseModel<BroadcastMessage> {
  protected tableName = 'broadcast_messages';
  protected knex = db;
}
