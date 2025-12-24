
import { UserModel } from './user.model.js';
import { TeamModel } from './team.model.js';
import { UserTeamModel } from './user-team.model.js';
import { ChatSessionModel } from './chat-session.model.js';
import { ChatMessageModel } from './chat-message.model.js';
import { MinioBucketModel } from './minio-bucket.model.js';
import { SystemConfigModel } from './system-config.model.js';
import { KnowledgeBaseSourceModel } from './knowledge-base-source.model.js';
import { AuditLogModel } from './audit-log.model.js';
import { UserIpHistoryModel } from './user-ip-history.model.js';
import { DocumentPermissionModel } from './document-permission.model.js';
import { BroadcastMessageModel } from './broadcast-message.model.js';
import { UserDismissedBroadcastModel } from './user-dismissed-broadcast.model.js';

export class ModelFactory {
  private static userModel: UserModel;
  private static teamModel: TeamModel;
  private static userTeamModel: UserTeamModel;
  private static chatSessionModel: ChatSessionModel;
  private static chatMessageModel: ChatMessageModel;
  private static minioBucketModel: MinioBucketModel;
  private static systemConfigModel: SystemConfigModel;
  private static knowledgeBaseSourceModel: KnowledgeBaseSourceModel;
  private static auditLogModel: AuditLogModel;
  private static userIpHistoryModel: UserIpHistoryModel;
  private static documentPermissionModel: DocumentPermissionModel;
  private static broadcastMessageModel: BroadcastMessageModel;
  private static userDismissedBroadcastModel: UserDismissedBroadcastModel;

  static get user() {
    if (!this.userModel) this.userModel = new UserModel();
    return this.userModel;
  }

  static get team() {
    if (!this.teamModel) this.teamModel = new TeamModel();
    return this.teamModel;
  }

  static get userTeam() {
    if (!this.userTeamModel) this.userTeamModel = new UserTeamModel();
    return this.userTeamModel;
  }

  static get chatSession() {
    if (!this.chatSessionModel) this.chatSessionModel = new ChatSessionModel();
    return this.chatSessionModel;
  }

  static get chatMessage() {
    if (!this.chatMessageModel) this.chatMessageModel = new ChatMessageModel();
    return this.chatMessageModel;
  }

  static get minioBucket() {
    if (!this.minioBucketModel) this.minioBucketModel = new MinioBucketModel();
    return this.minioBucketModel;
  }

  static get systemConfig() {
    if (!this.systemConfigModel) this.systemConfigModel = new SystemConfigModel();
    return this.systemConfigModel;
  }

  static get knowledgeBaseSource() {
    if (!this.knowledgeBaseSourceModel) this.knowledgeBaseSourceModel = new KnowledgeBaseSourceModel();
    return this.knowledgeBaseSourceModel;
  }

  static get auditLog() {
    if (!this.auditLogModel) this.auditLogModel = new AuditLogModel();
    return this.auditLogModel;
  }

  static get userIpHistory() {
    if (!this.userIpHistoryModel) this.userIpHistoryModel = new UserIpHistoryModel();
    return this.userIpHistoryModel;
  }

  static get documentPermission() {
    if (!this.documentPermissionModel) this.documentPermissionModel = new DocumentPermissionModel();
    return this.documentPermissionModel;
  }

  static get broadcastMessage() {
    if (!this.broadcastMessageModel) this.broadcastMessageModel = new BroadcastMessageModel();
    return this.broadcastMessageModel;
  }

  static get userDismissedBroadcast() {
    if (!this.userDismissedBroadcastModel) this.userDismissedBroadcastModel = new UserDismissedBroadcastModel();
    return this.userDismissedBroadcastModel;
  }
}
