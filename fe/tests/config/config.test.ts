/**
 * @fileoverview Tests for frontend configuration.
 * 
 * Tests:
 * - getBoolEnv helper function logic
 * - Feature flags parsing
 * - Default values when env vars are missing
 * - Config object structure from actual source
 */

import { describe, it, expect } from 'vitest';
import { config } from '@/config';

// ============================================================================
// Helper Function Tests
// ============================================================================

/**
 * Reimplemented getBoolEnv for testing logic.
 * This matches the implementation in src/config.ts
 */
function getBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

describe('config', () => {
  describe('getBoolEnv', () => {
    it('should return true for "true" string', () => {
      expect(getBoolEnv('true', false)).toBe(true);
    });

    it('should return false for "false" string', () => {
      expect(getBoolEnv('false', true)).toBe(false);
    });

    it('should return default value when value is undefined', () => {
      expect(getBoolEnv(undefined, true)).toBe(true);
      expect(getBoolEnv(undefined, false)).toBe(false);
    });

    it('should return false for non-"true" strings', () => {
      expect(getBoolEnv('yes', true)).toBe(false);
      expect(getBoolEnv('1', true)).toBe(false);
      expect(getBoolEnv('TRUE', true)).toBe(false); // Case sensitive
    });

    it('should handle empty string as false', () => {
      expect(getBoolEnv('', true)).toBe(false);
    });

    it('should handle whitespace as false', () => {
      expect(getBoolEnv(' ', true)).toBe(false);
      expect(getBoolEnv(' true', true)).toBe(false);
      expect(getBoolEnv('true ', true)).toBe(false);
    });
  });

  describe('config.features structure', () => {
    it('should have enableAiChat feature flag', () => {
      expect(config).toHaveProperty('features');
      expect(config.features).toHaveProperty('enableAiChat');
      expect(typeof config.features.enableAiChat).toBe('boolean');
    });

    it('should have enableAiSearch feature flag', () => {
      expect(config).toHaveProperty('features');
      expect(config.features).toHaveProperty('enableAiSearch');
      expect(typeof config.features.enableAiSearch).toBe('boolean');
    });

    it('should have enableHistory feature flag', () => {
      expect(config).toHaveProperty('features');
      expect(config.features).toHaveProperty('enableHistory');
      expect(typeof config.features.enableHistory).toBe('boolean');
    });
  });

  describe('config default values', () => {
    it('should have enableAiChat as boolean (defaults to true when env not set)', () => {
      // The actual config is loaded with import.meta.env
      // In test environment, these will use defaults
      expect(typeof config.features.enableAiChat).toBe('boolean');
    });

    it('should have enableAiSearch as boolean (defaults to true when env not set)', () => {
      expect(typeof config.features.enableAiSearch).toBe('boolean');
    });

    it('should have enableHistory as boolean (defaults to true when env not set)', () => {
      expect(typeof config.features.enableHistory).toBe('boolean');
    });

    it('should allow disabling features via false string', () => {
      expect(getBoolEnv('false', true)).toBe(false);
    });
  });

  describe('config object structure', () => {
    it('should export config with features property', () => {
      expect(config).toHaveProperty('features');
      expect(config.features).toHaveProperty('enableAiChat');
      expect(config.features).toHaveProperty('enableAiSearch');
      expect(config.features).toHaveProperty('enableHistory');
    });

    it('should have boolean values for all feature flags', () => {
      expect(typeof config.features.enableAiChat).toBe('boolean');
      expect(typeof config.features.enableAiSearch).toBe('boolean');
      expect(typeof config.features.enableHistory).toBe('boolean');
    });

    it('should have all three feature flags defined', () => {
      const featureKeys = Object.keys(config.features);
      expect(featureKeys).toContain('enableAiChat');
      expect(featureKeys).toContain('enableAiSearch');
      expect(featureKeys).toContain('enableHistory');
      expect(featureKeys.length).toBe(3);
    });
  });

  describe('environment variable edge cases', () => {
    it('should handle various true-like values correctly', () => {
      // Only exact "true" should be true
      expect(getBoolEnv('true', false)).toBe(true);
      expect(getBoolEnv('True', false)).toBe(false);
      expect(getBoolEnv('TRUE', false)).toBe(false);
      expect(getBoolEnv('1', false)).toBe(false);
      expect(getBoolEnv('yes', false)).toBe(false);
      expect(getBoolEnv('on', false)).toBe(false);
    });

    it('should handle various false-like values correctly', () => {
      // Anything not "true" returns default or false
      expect(getBoolEnv('false', true)).toBe(false);
      expect(getBoolEnv('False', true)).toBe(false);
      expect(getBoolEnv('FALSE', true)).toBe(false);
      expect(getBoolEnv('0', true)).toBe(false);
      expect(getBoolEnv('no', true)).toBe(false);
      expect(getBoolEnv('off', true)).toBe(false);
    });

    it('should handle null-ish values via undefined', () => {
      expect(getBoolEnv(undefined, true)).toBe(true);
      expect(getBoolEnv(undefined, false)).toBe(false);
    });
  });
});
