
/**
 * Lazy-loaded singletons for all data models to keep connection sharing consistent.
 */
import { UserModel } from '@/models/user.model.js';
import { TeamModel } from '@/models/team.model.js';
import { UserTeamModel } from '@/models/user-team.model.js';
import { ChatSessionModel } from '@/models/chat-session.model.js';
import { ChatMessageModel } from '@/models/chat-message.model.js';
import { MinioBucketModel } from '@/models/minio-bucket.model.js';
import { SystemConfigModel } from '@/models/system-config.model.js';
import { KnowledgeBaseSourceModel } from '@/models/knowledge-base-source.model.js';
import { AuditLogModel } from '@/models/audit-log.model.js';
import { UserIpHistoryModel } from '@/models/user-ip-history.model.js';
import { DocumentPermissionModel } from '@/models/document-permission.model.js';
import { BroadcastMessageModel } from '@/models/broadcast-message.model.js';
import { UserDismissedBroadcastModel } from '@/models/user-dismissed-broadcast.model.js';
import { ExternalChatHistoryModel } from '@/models/external/chat-history.model.js';
import { ExternalSearchHistoryModel } from '@/models/external/search-history.model.js';

/**
 * ModelFactory class implementing the Factory Pattern.
 * Provides lazy-loaded singletons for all data models.
 * Ensures connection sharing is consistent across the application.
 * Each model is instantiated only once on first access.
 */
export class ModelFactory {
  // Private static fields to hold singleton instances
  /** User model singleton instance */
  private static userModel: UserModel;
  /** Team model singleton instance */
  private static teamModel: TeamModel;
  /** User-Team relationship model singleton instance */
  private static userTeamModel: UserTeamModel;
  /** Chat session model singleton instance */
  private static chatSessionModel: ChatSessionModel;
  /** Chat message model singleton instance */
  private static chatMessageModel: ChatMessageModel;
  /** MinIO bucket model singleton instance */
  private static minioBucketModel: MinioBucketModel;
  /** System config model singleton instance */
  private static systemConfigModel: SystemConfigModel;
  /** Knowledge base source model singleton instance */
  private static knowledgeBaseSourceModel: KnowledgeBaseSourceModel;
  /** Audit log model singleton instance */
  private static auditLogModel: AuditLogModel;
  /** User IP history model singleton instance */
  private static userIpHistoryModel: UserIpHistoryModel;
  /** Document permission model singleton instance */
  private static documentPermissionModel: DocumentPermissionModel;
  /** Broadcast message model singleton instance */
  private static broadcastMessageModel: BroadcastMessageModel;
  /** User dismissed broadcast model singleton instance */
  private static userDismissedBroadcastModel: UserDismissedBroadcastModel;
  /** External chat history model singleton instance */
  private static externalChatHistoryModel: ExternalChatHistoryModel;
  /** External search history model singleton instance */
  private static externalSearchHistoryModel: ExternalSearchHistoryModel;

  /**
   * Get the User model singleton.
   * Lazily instantiates the model on first access.
   * @returns UserModel instance for user CRUD operations
   */
  static get user() {
    // Create instance on first access (lazy initialization)
    if (!this.userModel) this.userModel = new UserModel();
    return this.userModel;
  }

  /**
   * Get the Team model singleton.
   * Lazily instantiates the model on first access.
   * @returns TeamModel instance for team CRUD operations
   */
  static get team() {
    if (!this.teamModel) this.teamModel = new TeamModel();
    return this.teamModel;
  }

  /**
   * Get the UserTeam model singleton.
   * Manages user-to-team membership relationships.
   * @returns UserTeamModel instance for user-team relationship operations
   */
  static get userTeam() {
    if (!this.userTeamModel) this.userTeamModel = new UserTeamModel();
    return this.userTeamModel;
  }

  /**
   * Get the ChatSession model singleton.
   * Manages chat conversation sessions.
   * @returns ChatSessionModel instance for session CRUD operations
   */
  static get chatSession() {
    if (!this.chatSessionModel) this.chatSessionModel = new ChatSessionModel();
    return this.chatSessionModel;
  }

  /**
   * Get the ChatMessage model singleton.
   * Manages individual chat messages within sessions.
   * @returns ChatMessageModel instance for message CRUD operations
   */
  static get chatMessage() {
    if (!this.chatMessageModel) this.chatMessageModel = new ChatMessageModel();
    return this.chatMessageModel;
  }

  /**
   * Get the MinioBucket model singleton.
   * Manages MinIO bucket metadata and configuration.
   * @returns MinioBucketModel instance for bucket CRUD operations
   */
  static get minioBucket() {
    if (!this.minioBucketModel) this.minioBucketModel = new MinioBucketModel();
    return this.minioBucketModel;
  }

  /**
   * Get the SystemConfig model singleton.
   * Manages key-value system configuration storage.
   * @returns SystemConfigModel instance for config CRUD operations
   */
  static get systemConfig() {
    if (!this.systemConfigModel) this.systemConfigModel = new SystemConfigModel();
    return this.systemConfigModel;
  }

  /**
   * Get the KnowledgeBaseSource model singleton.
   * Manages knowledge base source metadata and ACLs.
   * @returns KnowledgeBaseSourceModel instance for source CRUD operations
   */
  static get knowledgeBaseSource() {
    if (!this.knowledgeBaseSourceModel) this.knowledgeBaseSourceModel = new KnowledgeBaseSourceModel();
    return this.knowledgeBaseSourceModel;
  }

  /**
   * Get the AuditLog model singleton.
   * Manages audit trail entries for security and compliance.
   * @returns AuditLogModel instance for audit log operations
   */
  static get auditLog() {
    if (!this.auditLogModel) this.auditLogModel = new AuditLogModel();
    return this.auditLogModel;
  }

  /**
   * Get the UserIpHistory model singleton.
   * Manages user IP address history for tracking.
   * @returns UserIpHistoryModel instance for IP history operations
   */
  static get userIpHistory() {
    if (!this.userIpHistoryModel) this.userIpHistoryModel = new UserIpHistoryModel();
    return this.userIpHistoryModel;
  }

  /**
   * Get the DocumentPermission model singleton.
   * Manages per-user and per-team access to MinIO buckets.
   * @returns DocumentPermissionModel instance for permission operations
   */
  static get documentPermission() {
    if (!this.documentPermissionModel) this.documentPermissionModel = new DocumentPermissionModel();
    return this.documentPermissionModel;
  }

  /**
   * Get the BroadcastMessage model singleton.
   * Manages system-wide broadcast messages.
   * @returns BroadcastMessageModel instance for broadcast operations
   */
  static get broadcastMessage() {
    if (!this.broadcastMessageModel) this.broadcastMessageModel = new BroadcastMessageModel();
    return this.broadcastMessageModel;
  }

  /**
   * Get the UserDismissedBroadcast model singleton.
   * Tracks which broadcasts users have dismissed.
   * @returns UserDismissedBroadcastModel instance for dismissed broadcast operations
   */
  static get userDismissedBroadcast() {
    if (!this.userDismissedBroadcastModel) this.userDismissedBroadcastModel = new UserDismissedBroadcastModel();
    return this.userDismissedBroadcastModel;
  }

  /**
   * Get the ExternalChatHistory model singleton.
   * Manages chat history from external API integrations.
   * @returns ExternalChatHistoryModel instance for external chat history operations
   */
  static get externalChatHistory() {
    if (!this.externalChatHistoryModel) this.externalChatHistoryModel = new ExternalChatHistoryModel();
    return this.externalChatHistoryModel;
  }

  /**
   * Get the ExternalSearchHistory model singleton.
   * Manages search history from external API integrations.
   * @returns ExternalSearchHistoryModel instance for external search history operations
   */
  static get externalSearchHistory() {
    if (!this.externalSearchHistoryModel) this.externalSearchHistoryModel = new ExternalSearchHistoryModel();
    return this.externalSearchHistoryModel;
  }
}
