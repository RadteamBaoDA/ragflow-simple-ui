/**
 * @fileoverview Unit tests for user service.
 * 
 * Tests user management operations with mocked database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne } from '../../src/db/index.js';
import { userService, UserService } from '../../src/services/user.service.js';

// Get mocked functions
const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeRootUser', () => {
    it('should skip initialization if users exist', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: 5 });

      await userService.initializeRootUser();

      // Should only call queryOne for count check, not insert
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should create root user if no users exist', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: 0 });
      mockQuery.mockResolvedValueOnce([]);

      await userService.initializeRootUser();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          'root-user',
          expect.any(String), // email
          'System Administrator',
          'admin',
          expect.any(String), // permissions JSON
        ])
      );
    });

    it('should handle database error gracefully', async () => {
      mockQueryOne.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await expect(userService.initializeRootUser()).resolves.not.toThrow();
    });
  });

  describe('findOrCreateUser', () => {
    const mockAzureAdUser = {
      id: 'azure-user-123',
      email: 'user@example.com',
      name: 'Test User',
      displayName: 'Test User',
      department: 'IT',
      jobTitle: 'Developer',
      mobilePhone: '+1234567890',
    };

    it('should return existing user if found', async () => {
      const existingUser = {
        id: 'azure-user-123',
        email: 'user@example.com',
        display_name: 'Test User',
        role: 'manager',
        permissions: '["view_chat"]',
        department: 'IT',
        job_title: 'Developer',
        mobile_phone: '+1234567890',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockQueryOne.mockResolvedValueOnce(existingUser);

      const result = await userService.findOrCreateUser(mockAzureAdUser);

      expect(result.id).toBe('azure-user-123');
      expect(result.role).toBe('manager');
      expect(result.permissions).toEqual(['view_chat']);
    });

    it('should update user if Azure AD data changed', async () => {
      const existingUser = {
        id: 'azure-user-123',
        email: 'old@example.com', // Different email
        display_name: 'Old Name', // Different name
        role: 'user',
        permissions: '[]',
        department: 'Sales', // Different department
        job_title: 'Analyst', // Different title
        mobile_phone: null, // No phone
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockQueryOne.mockResolvedValueOnce(existingUser);
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.findOrCreateUser(mockAzureAdUser);

      // Should update with new values
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining([
          'Test User', // display_name
          'user@example.com', // email
          'IT', // department
          'Developer', // job_title
          '+1234567890', // mobile_phone
        ])
      );

      // Should return updated values
      expect(result.display_name).toBe('Test User');
      expect(result.email).toBe('user@example.com');
    });

    it('should not update if nothing changed', async () => {
      const existingUser = {
        id: 'azure-user-123',
        email: 'user@example.com',
        display_name: 'Test User',
        role: 'user',
        permissions: '[]',
        department: 'IT',
        job_title: 'Developer',
        mobile_phone: '+1234567890',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockQueryOne.mockResolvedValueOnce(existingUser);

      await userService.findOrCreateUser(mockAzureAdUser);

      // Should not call UPDATE if nothing changed
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      mockQueryOne.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.findOrCreateUser(mockAzureAdUser);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          'azure-user-123',
          'user@example.com',
          'Test User',
          'user', // Default role
        ])
      );
      expect(result.role).toBe('user');
    });

    it('should handle Azure AD user without optional fields', async () => {
      const minimalUser = {
        id: 'azure-user-456',
        email: 'minimal@example.com',
        name: 'Minimal User',
        displayName: 'Minimal User',
      };
      mockQueryOne.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.findOrCreateUser(minimalUser);

      expect(result.department).toBeNull();
      expect(result.job_title).toBeNull();
      expect(result.mobile_phone).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockQueryOne.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(userService.findOrCreateUser(mockAzureAdUser)).rejects.toThrow('Connection failed');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users with parsed permissions', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'user1@example.com',
          display_name: 'User One',
          role: 'admin',
          permissions: '["manage_users","manage_system"]',
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          display_name: 'User Two',
          role: 'user',
          permissions: '[]',
        },
      ]);

      const result = await userService.getAllUsers();

      expect(result).toHaveLength(2);
      expect(result[0]?.permissions).toEqual(['manage_users', 'manage_system']);
      expect(result[1]?.permissions).toEqual([]);
    });

    it('should handle already-parsed permissions', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'user1@example.com',
          display_name: 'User One',
          role: 'admin',
          permissions: ['already', 'parsed'],
        },
      ]);

      const result = await userService.getAllUsers();

      expect(result[0]?.permissions).toEqual(['already', 'parsed']);
    });

    it('should return empty array when no users', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.getAllUsers();

      expect(result).toEqual([]);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role and return updated user', async () => {
      mockQuery.mockResolvedValueOnce([]);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'user@example.com',
        role: 'manager',
        permissions: '["manage_users"]',
      });

      const result = await userService.updateUserRole('user-123', 'manager');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role'),
        ['manager', 'user-123']
      );
      expect(result?.role).toBe('manager');
    });

    it('should return undefined if user not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      mockQueryOne.mockResolvedValueOnce(undefined);

      const result = await userService.updateUserRole('nonexistent', 'admin');

      expect(result).toBeUndefined();
    });

    it('should parse permissions from JSON string', async () => {
      mockQuery.mockResolvedValueOnce([]);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        role: 'admin',
        permissions: '["view_chat","manage_system"]',
      });

      const result = await userService.updateUserRole('user-123', 'admin');

      expect(result?.permissions).toEqual(['view_chat', 'manage_system']);
    });
  });

  describe('recordUserIp', () => {
    it('should record user IP with upsert', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await userService.recordUserIp('user-123', '192.168.1.1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_ip_history'),
        ['user-123', '192.168.1.1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should skip recording if IP is empty', async () => {
      await userService.recordUserIp('user-123', '');

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should skip recording if IP is "unknown"', async () => {
      await userService.recordUserIp('user-123', 'unknown');

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should not throw on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await expect(userService.recordUserIp('user-123', '192.168.1.1')).resolves.not.toThrow();
    });
  });

  describe('getUserIpHistory', () => {
    it('should return IP history for user', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 1, user_id: 'user-123', ip_address: '192.168.1.1', last_accessed_at: '2024-01-15T10:00:00Z' },
        { id: 2, user_id: 'user-123', ip_address: '10.0.0.1', last_accessed_at: '2024-01-14T10:00:00Z' },
      ]);

      const result = await userService.getUserIpHistory('user-123');

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_ip_history WHERE user_id = $1'),
        ['user-123']
      );
    });

    it('should return empty array for user with no IP history', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.getUserIpHistory('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getAllUsersIpHistory', () => {
    it('should return IP history grouped by user', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 1, user_id: 'user-1', ip_address: '192.168.1.1', last_accessed_at: '2024-01-15T10:00:00Z' },
        { id: 2, user_id: 'user-1', ip_address: '10.0.0.1', last_accessed_at: '2024-01-14T10:00:00Z' },
        { id: 3, user_id: 'user-2', ip_address: '172.16.0.1', last_accessed_at: '2024-01-15T09:00:00Z' },
      ]);

      const result = await userService.getAllUsersIpHistory();

      expect(result).toBeInstanceOf(Map);
      expect(result.get('user-1')).toHaveLength(2);
      expect(result.get('user-2')).toHaveLength(1);
    });

    it('should return empty map when no history exists', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await userService.getAllUsersIpHistory();

      expect(result.size).toBe(0);
    });
  });
});
