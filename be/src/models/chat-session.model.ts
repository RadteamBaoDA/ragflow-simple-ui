
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { ChatSession } from './types.js';

export class ChatSessionModel extends BaseModel<ChatSession> {
  protected tableName = 'chat_sessions';
  protected knex = db;
}
