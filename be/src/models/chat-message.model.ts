
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { ChatMessage } from './types.js';

export class ChatMessageModel extends BaseModel<ChatMessage> {
  protected tableName = 'chat_messages';
  protected knex = db;
}
