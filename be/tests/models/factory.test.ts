/**
 * @fileoverview Unit tests for ModelFactory singleton pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('ModelFactory', () => {
  let ModelFactory: any;

  beforeEach(async () => {
    // Clear module cache to ensure fresh imports
    const module = await import('../../src/models/factory.js');
    ModelFactory = module.ModelFactory;
  });

  describe('Singleton pattern', () => {
    it('should return same user model instance on multiple calls', () => {
      const instance1 = ModelFactory.user;
      const instance2 = ModelFactory.user;

      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return same team model instance on multiple calls', () => {
      const instance1 = ModelFactory.team;
      const instance2 = ModelFactory.team;

      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return same userTeam model instance on multiple calls', () => {
      const instance1 = ModelFactory.userTeam;
      const instance2 = ModelFactory.userTeam;

      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });
  });

  describe('Model instantiation', () => {
    it('should instantiate chatSession model', () => {
      const model = ModelFactory.chatSession;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('ChatSessionModel');
    });

    it('should instantiate chatMessage model', () => {
      const model = ModelFactory.chatMessage;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('ChatMessageModel');
    });

    it('should instantiate minioBucket model', () => {
      const model = ModelFactory.minioBucket;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('MinioBucketModel');
    });

    it('should instantiate systemConfig model', () => {
      const model = ModelFactory.systemConfig;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('SystemConfigModel');
    });

    it('should instantiate knowledgeBaseSource model', () => {
      const model = ModelFactory.knowledgeBaseSource;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('KnowledgeBaseSourceModel');
    });

    it('should instantiate auditLog model', () => {
      const model = ModelFactory.auditLog;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('AuditLogModel');
    });

    it('should instantiate userIpHistory model', () => {
      const model = ModelFactory.userIpHistory;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('UserIpHistoryModel');
    });

    it('should instantiate documentPermission model', () => {
      const model = ModelFactory.documentPermission;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('DocumentPermissionModel');
    });

    it('should instantiate broadcastMessage model', () => {
      const model = ModelFactory.broadcastMessage;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('BroadcastMessageModel');
    });

    it('should instantiate userDismissedBroadcast model', () => {
      const model = ModelFactory.userDismissedBroadcast;

      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('UserDismissedBroadcastModel');
    });
  });

  describe('All models accessible', () => {
    it('should provide access to all 13 model types', () => {
      expect(ModelFactory.user).toBeDefined();
      expect(ModelFactory.team).toBeDefined();
      expect(ModelFactory.userTeam).toBeDefined();
      expect(ModelFactory.chatSession).toBeDefined();
      expect(ModelFactory.chatMessage).toBeDefined();
      expect(ModelFactory.minioBucket).toBeDefined();
      expect(ModelFactory.systemConfig).toBeDefined();
      expect(ModelFactory.knowledgeBaseSource).toBeDefined();
      expect(ModelFactory.auditLog).toBeDefined();
      expect(ModelFactory.userIpHistory).toBeDefined();
      expect(ModelFactory.documentPermission).toBeDefined();
      expect(ModelFactory.broadcastMessage).toBeDefined();
      expect(ModelFactory.userDismissedBroadcast).toBeDefined();
    });

    it('should not create duplicate instances', () => {
      // Access all models
      const models = [
        ModelFactory.user,
        ModelFactory.team,
        ModelFactory.userTeam,
        ModelFactory.chatSession,
        ModelFactory.chatMessage,
        ModelFactory.minioBucket,
        ModelFactory.systemConfig,
        ModelFactory.knowledgeBaseSource,
        ModelFactory.auditLog,
        ModelFactory.userIpHistory,
        ModelFactory.documentPermission,
        ModelFactory.broadcastMessage,
        ModelFactory.userDismissedBroadcast,
      ];

      // Access them again
      const modelsAgain = [
        ModelFactory.user,
        ModelFactory.team,
        ModelFactory.userTeam,
        ModelFactory.chatSession,
        ModelFactory.chatMessage,
        ModelFactory.minioBucket,
        ModelFactory.systemConfig,
        ModelFactory.knowledgeBaseSource,
        ModelFactory.auditLog,
        ModelFactory.userIpHistory,
        ModelFactory.documentPermission,
        ModelFactory.broadcastMessage,
        ModelFactory.userDismissedBroadcast,
      ];

      // Verify same instances
      models.forEach((model, index) => {
        expect(model).toBe(modelsAgain[index]);
      });
    });
  });
});
