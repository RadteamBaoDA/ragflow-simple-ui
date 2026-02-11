
/**
 * Lazy-loaded singletons for all data models to keep connection sharing consistent.
 */
import { UserModel } from '@/modules/users/user.model.js';
import { TeamModel } from '@/modules/teams/team.model.js';
import { UserTeamModel } from '@/modules/teams/user-team.model.js';
import { ChatSessionModel } from '@/modules/chat/chat-session.model.js';
import { ChatMessageModel } from '@/modules/chat/chat-message.model.js';
import { SystemConfigModel } from '@/shared/models/system-config.model.js';
import { KnowledgeBaseSourceModel } from '@/modules/knowledge-base/knowledge-base-source.model.js';
import { AuditLogModel } from '@/modules/audit/audit-log.model.js';
import { UserIpHistoryModel } from '@/modules/users/user-ip-history.model.js';
import { BroadcastMessageModel } from '@/modules/broadcast/broadcast-message.model.js';
import { UserDismissedBroadcastModel } from '@/modules/broadcast/user-dismissed-broadcast.model.js';
import { ExternalChatSessionModel } from '@/modules/external/models/chat-session.model.js';
import { ExternalChatMessageModel } from '@/modules/external/models/chat-message.model.js';
import { ExternalSearchSessionModel } from '@/modules/external/models/search-session.model.js';
import { ExternalSearchRecordModel } from '@/modules/external/models/search-record.model.js';

import { GlossaryTaskModel } from '@/modules/glossary/glossary-task.model.js';
import { GlossaryKeywordModel } from '@/modules/glossary/glossary-keyword.model.js';
import { RagflowServerModel } from '@/modules/admin/ragflow-servers/ragflow-server.model.js';
import { ProjectModel } from '@/modules/projects/project.model.js';
import { ProjectPermissionModel } from '@/modules/projects/project-permission.model.js';
import { DocumentCategoryModel } from '@/modules/projects/document-category/document-category.model.js';
import { DocumentCategoryVersionModel } from '@/modules/projects/document-category/document-category-version.model.js';
import { ProjectChatModel } from '@/modules/projects/project-chat/project-chat.model.js';

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
  /** System config model singleton instance */
  private static systemConfigModel: SystemConfigModel;
  /** Knowledge base source model singleton instance */
  private static knowledgeBaseSourceModel: KnowledgeBaseSourceModel;
  /** Audit log model singleton instance */
  private static auditLogModel: AuditLogModel;
  /** User IP history model singleton instance */
  private static userIpHistoryModel: UserIpHistoryModel;
  /** Broadcast message model singleton instance */
  private static broadcastMessageModel: BroadcastMessageModel;
  /** User dismissed broadcast model singleton instance */
  private static userDismissedBroadcastModel: UserDismissedBroadcastModel;

  // External History Models
  private static externalChatSessionModel: ExternalChatSessionModel;
  private static externalChatMessageModel: ExternalChatMessageModel;
  private static externalSearchSessionModel: ExternalSearchSessionModel;
  private static externalSearchRecordModel: ExternalSearchRecordModel;




  // Glossary Models
  /** Glossary task model singleton instance */
  private static glossaryTaskModel: GlossaryTaskModel;
  /** Glossary keyword model singleton instance */
  private static glossaryKeywordModel: GlossaryKeywordModel;

  // Project Management Models
  /** RAGFlow server model singleton instance */
  private static ragflowServerModel: RagflowServerModel;
  /** Project model singleton instance */
  private static projectModel: ProjectModel;
  /** Project permission model singleton instance */
  private static projectPermissionModel: ProjectPermissionModel;
  /** Document category model singleton instance */
  private static documentCategoryModel: DocumentCategoryModel;
  /** Document category version model singleton instance */
  private static documentCategoryVersionModel: DocumentCategoryVersionModel;
  /** Project chat model singleton instance */
  private static projectChatModel: ProjectChatModel;


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
    // Create instance on first access (lazy initialization)
    if (!this.teamModel) this.teamModel = new TeamModel();
    return this.teamModel;
  }

  /**
   * Get the UserTeam model singleton.
   * Manages user-to-team membership relationships.
   * @returns UserTeamModel instance for user-team relationship operations
   */
  static get userTeam() {
    // Create instance on first access (lazy initialization)
    if (!this.userTeamModel) this.userTeamModel = new UserTeamModel();
    return this.userTeamModel;
  }

  /**
   * Get the ChatSession model singleton.
   * Manages chat conversation sessions.
   * @returns ChatSessionModel instance for session CRUD operations
   */
  static get chatSession() {
    // Create instance on first access (lazy initialization)
    if (!this.chatSessionModel) this.chatSessionModel = new ChatSessionModel();
    return this.chatSessionModel;
  }

  /**
   * Get the ChatMessage model singleton.
   * Manages individual chat messages within sessions.
   * @returns ChatMessageModel instance for message CRUD operations
   */
  static get chatMessage() {
    // Create instance on first access (lazy initialization)
    if (!this.chatMessageModel) this.chatMessageModel = new ChatMessageModel();
    return this.chatMessageModel;
  }

  /**
   * Get the SystemConfig model singleton.
   * Manages key-value system configuration storage.
   * @returns SystemConfigModel instance for config CRUD operations
   */
  static get systemConfig() {
    // Create instance on first access (lazy initialization)
    if (!this.systemConfigModel) this.systemConfigModel = new SystemConfigModel();
    return this.systemConfigModel;
  }

  /**
   * Get the KnowledgeBaseSource model singleton.
   * Manages knowledge base source metadata and ACLs.
   * @returns KnowledgeBaseSourceModel instance for source CRUD operations
   */
  static get knowledgeBaseSource() {
    // Create instance on first access (lazy initialization)
    if (!this.knowledgeBaseSourceModel) this.knowledgeBaseSourceModel = new KnowledgeBaseSourceModel();
    return this.knowledgeBaseSourceModel;
  }

  /**
   * Get the AuditLog model singleton.
   * Manages audit trail entries for security and compliance.
   * @returns AuditLogModel instance for audit log operations
   */
  static get auditLog() {
    // Create instance on first access (lazy initialization)
    if (!this.auditLogModel) this.auditLogModel = new AuditLogModel();
    return this.auditLogModel;
  }

  /**
   * Get the UserIpHistory model singleton.
   * Manages user IP address history for tracking.
   * @returns UserIpHistoryModel instance for IP history operations
   */
  static get userIpHistory() {
    // Create instance on first access (lazy initialization)
    if (!this.userIpHistoryModel) this.userIpHistoryModel = new UserIpHistoryModel();
    return this.userIpHistoryModel;
  }

  /**
   * Get the BroadcastMessage model singleton.
   * Manages system-wide broadcast messages.
   * @returns BroadcastMessageModel instance for broadcast operations
   */
  static get broadcastMessage() {
    // Create instance on first access (lazy initialization)
    if (!this.broadcastMessageModel) this.broadcastMessageModel = new BroadcastMessageModel();
    return this.broadcastMessageModel;
  }

  /**
   * Get the UserDismissedBroadcast model singleton.
   * Tracks which broadcasts users have dismissed.
   * @returns UserDismissedBroadcastModel instance for dismissed broadcast operations
   */
  static get userDismissedBroadcast() {
    // Create instance on first access (lazy initialization)
    if (!this.userDismissedBroadcastModel) this.userDismissedBroadcastModel = new UserDismissedBroadcastModel();
    return this.userDismissedBroadcastModel;
  }

  /**
   * Get the ExternalChatSession model singleton.
   */
  static get externalChatSession() {
    if (!this.externalChatSessionModel) this.externalChatSessionModel = new ExternalChatSessionModel();
    return this.externalChatSessionModel;
  }

  /**
   * Get the ExternalChatMessage model singleton.
   */
  static get externalChatMessage() {
    if (!this.externalChatMessageModel) this.externalChatMessageModel = new ExternalChatMessageModel();
    return this.externalChatMessageModel;
  }

  /**
   * Get the ExternalSearchSession model singleton.
   */
  static get externalSearchSession() {
    if (!this.externalSearchSessionModel) this.externalSearchSessionModel = new ExternalSearchSessionModel();
    return this.externalSearchSessionModel;
  }

  /**
   * Get the ExternalSearchRecord model singleton.
   */
  static get externalSearchRecord() {
    if (!this.externalSearchRecordModel) this.externalSearchRecordModel = new ExternalSearchRecordModel();
    return this.externalSearchRecordModel;
  }




  /**
   * Get the GlossaryTask model singleton.
   * Manages glossary tasks for prompt builder.
   * @returns GlossaryTaskModel instance for task operations
   */
  static get glossaryTask() {
    if (!this.glossaryTaskModel) this.glossaryTaskModel = new GlossaryTaskModel();
    return this.glossaryTaskModel;
  }

  /**
   * Get the GlossaryKeyword model singleton.
   * Manages glossary keywords belonging to tasks.
   * @returns GlossaryKeywordModel instance for keyword operations
   */
  static get glossaryKeyword() {
    if (!this.glossaryKeywordModel) this.glossaryKeywordModel = new GlossaryKeywordModel();
    return this.glossaryKeywordModel;
  }

  /**
   * Get the RagflowServer model singleton.
   * Manages RAGFlow server connection records.
   * @returns RagflowServerModel instance
   */
  static get ragflowServer() {
    if (!this.ragflowServerModel) this.ragflowServerModel = new RagflowServerModel();
    return this.ragflowServerModel;
  }

  /**
   * Get the Project model singleton.
   * Manages centralized project records.
   * @returns ProjectModel instance
   */
  static get project() {
    if (!this.projectModel) this.projectModel = new ProjectModel();
    return this.projectModel;
  }

  /**
   * Get the ProjectPermission model singleton.
   * Manages granular per-tab access control.
   * @returns ProjectPermissionModel instance
   */
  static get projectPermission() {
    if (!this.projectPermissionModel) this.projectPermissionModel = new ProjectPermissionModel();
    return this.projectPermissionModel;
  }

  /**
   * Get the DocumentCategory model singleton.
   * Manages document categories within projects.
   * @returns DocumentCategoryModel instance
   */
  static get documentCategory() {
    if (!this.documentCategoryModel) this.documentCategoryModel = new DocumentCategoryModel();
    return this.documentCategoryModel;
  }

  /**
   * Get the DocumentCategoryVersion model singleton.
   * Manages versions within document categories.
   * @returns DocumentCategoryVersionModel instance
   */
  static get documentCategoryVersion() {
    if (!this.documentCategoryVersionModel) this.documentCategoryVersionModel = new DocumentCategoryVersionModel();
    return this.documentCategoryVersionModel;
  }

  /**
   * Get the ProjectChat model singleton.
   * Manages chat assistants linked to projects.
   * @returns ProjectChatModel instance
   */
  static get projectChat() {
    if (!this.projectChatModel) this.projectChatModel = new ProjectChatModel();
    return this.projectChatModel;
  }
}
