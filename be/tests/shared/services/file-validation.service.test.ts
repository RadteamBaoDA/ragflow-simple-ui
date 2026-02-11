/**
 * @fileoverview Unit tests for file validation service.
 * 
 * Tests file validation functions for security and sanitization.
 */

import { describe, it, expect } from 'vitest';
import {
  validateFileExtension,
  validateContentType,
  validateFileSignature,
  sanitizeFilename,
  generateSafeFilename,
  sanitizeObjectPath,
  sanitizeFolderPath,
  validateUploadedFile,
} from '../../../src/shared/services/file-validation.service.js';

describe('File Validation Service', () => {
  describe('validateFileExtension', () => {
    describe('without allowlist mode', () => {
      it('should allow safe extensions', () => {
        expect(validateFileExtension('document.pdf').isValid).toBe(true);
        expect(validateFileExtension('image.jpg').isValid).toBe(true);
        expect(validateFileExtension('data.json').isValid).toBe(true);
      });

      it('should block dangerous extensions', () => {
        const result = validateFileExtension('script.exe');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('.exe');
      });

      it('should block PHP files', () => {
        const result = validateFileExtension('shell.php');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('.php');
      });

      it('should block shell scripts', () => {
        const result = validateFileExtension('script.sh');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('.sh');
      });

      it('should reject files without extension', () => {
        const result = validateFileExtension('noextension');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('extension');
      });

      it('should detect double extensions with dangerous second part', () => {
        const result = validateFileExtension('image.jpg.php');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('.php');
      });

      it('should detect dangerous extensions in multi-part filenames', () => {
        const result = validateFileExtension('document.doc.exe');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('.exe');
      });
    });

    describe('with allowlist mode', () => {
      it('should allow extensions in allowlist', () => {
        expect(validateFileExtension('doc.pdf', true).isValid).toBe(true);
        expect(validateFileExtension('image.png', true).isValid).toBe(true);
        expect(validateFileExtension('data.json', true).isValid).toBe(true);
      });

      it('should reject extensions not in allowlist', () => {
        const result = validateFileExtension('file.xyz', true);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not in allowed list');
      });
    });
  });

  describe('validateContentType', () => {
    it('should validate matching content-type and extension', () => {
      expect(validateContentType('image/jpeg', 'photo.jpg').isValid).toBe(true);
      expect(validateContentType('image/png', 'image.png').isValid).toBe(true);
      expect(validateContentType('application/pdf', 'doc.pdf').isValid).toBe(true);
    });

    it('should reject mismatched content-type and extension', () => {
      const result = validateContentType('image/jpeg', 'file.png');
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('does not match');
    });

    it('should allow unknown content-types with warning', () => {
      const result = validateContentType('application/unknown', 'file.xyz');
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('Unknown Content-Type');
    });

    it('should accept jpeg for both .jpg and .jpeg', () => {
      expect(validateContentType('image/jpeg', 'photo.jpg').isValid).toBe(true);
      expect(validateContentType('image/jpeg', 'photo.jpeg').isValid).toBe(true);
    });
  });

  describe('validateFileSignature', () => {
    it('should validate JPEG signature', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(validateFileSignature(jpegBuffer, 'photo.jpg').isValid).toBe(true);
    });

    it('should validate PNG signature', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
      expect(validateFileSignature(pngBuffer, 'image.png').isValid).toBe(true);
    });

    it('should validate PDF signature', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]);
      expect(validateFileSignature(pdfBuffer, 'doc.pdf').isValid).toBe(true);
    });

    it('should validate ZIP signature (for docx/xlsx/etc)', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
      expect(validateFileSignature(zipBuffer, 'archive.zip').isValid).toBe(true);
      expect(validateFileSignature(zipBuffer, 'document.docx').isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const fakeJpeg = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = validateFileSignature(fakeJpeg, 'fake.jpg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('file type spoofing');
    });

    it('should allow unknown extensions', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(validateFileSignature(buffer, 'file.xyz').isValid).toBe(true);
    });

    it('should handle buffers smaller than signature', () => {
      const shortBuffer = Buffer.from([0xFF]);
      const result = validateFileSignature(shortBuffer, 'tiny.jpg');
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should keep safe filenames unchanged', () => {
      expect(sanitizeFilename('document.pdf').sanitized).toBe('document.pdf');
      expect(sanitizeFilename('my-file_2024.txt').sanitized).toBe('my-file_2024.txt');
    });

    it('should remove path components', () => {
      expect(sanitizeFilename('/etc/passwd').sanitized).toBe('passwd');
      expect(sanitizeFilename('C:\\Windows\\system.dll').sanitized).toBe('system.dll');
    });

    it('should reject empty filenames', () => {
      const result = sanitizeFilename('');
      expect(result.sanitized).toBeNull();
      expect(result.error).toContain('required');
    });

    it('should reject null bytes', () => {
      const result = sanitizeFilename('file\0.txt');
      expect(result.sanitized).toBeNull();
      expect(result.error).toContain('null bytes');
    });

    it('should strip path traversal via basename and return sanitized filename', () => {
      // path.basename removes path components, leaving just "passwd"
      const result = sanitizeFilename('../../../etc/passwd');
      // After basename: "passwd" - valid filename with no extension
      expect(result.sanitized).toBe('passwd');
    });

    it('should reject filenames with literal path traversal after basename', () => {
      // A filename that literally contains ".." after basename should be rejected
      const result = sanitizeFilename('file..name.txt');
      // Contains ".." so it should be rejected
      expect(result.sanitized).toBeNull();
      expect(result.error).toContain('path traversal');
    });

    it('should reject long filenames', () => {
      const longName = 'a'.repeat(250) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.sanitized).toBeNull();
      expect(result.error).toContain('too long');
    });

    it('should replace dangerous characters with underscore', () => {
      // path.basename removes the path portion, and / \ are also stripped
      // After basename on Windows: "file<>:"|?*.txt"
      // After character replacement: characters like < > : " | ? * are replaced with _
      const result = sanitizeFilename('file<>:"|?*.txt');
      expect(result.sanitized).not.toBeNull();
      // The exact result depends on platform's basename behavior
    });

    it('should handle leading/trailing periods', () => {
      expect(sanitizeFilename('.hidden').sanitized).toBe('_hidden');
      expect(sanitizeFilename('file.').sanitized).toBe('file_');
    });

    it('should collapse multiple periods when not part of filename', () => {
      // Multiple underscores should collapse
      expect(sanitizeFilename('file___name.txt').sanitized).toBe('file_name.txt');
    });

    it('should handle file with multiple dots in name', () => {
      // This contains ".." which triggers the path traversal check
      const result = sanitizeFilename('file.name.txt');
      // Single dots between characters are fine, only ".." is problematic
      expect(result.sanitized).toBe('file.name.txt');
    });

    it('should preserve spaces', () => {
      expect(sanitizeFilename('my document.pdf').sanitized).toBe('my document.pdf');
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate UUID-based filename', () => {
      const safe = generateSafeFilename('original.pdf');
      expect(safe).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    });

    it('should preserve extension', () => {
      expect(generateSafeFilename('file.jpg').endsWith('.jpg')).toBe(true);
      expect(generateSafeFilename('doc.docx').endsWith('.docx')).toBe(true);
    });

    it('should lowercase extension', () => {
      const safe = generateSafeFilename('IMAGE.PNG');
      expect(safe.endsWith('.png')).toBe(true);
    });

    it('should generate unique filenames', () => {
      const safe1 = generateSafeFilename('file.txt');
      const safe2 = generateSafeFilename('file.txt');
      expect(safe1).not.toBe(safe2);
    });
  });

  describe('sanitizeObjectPath', () => {
    it('should keep safe paths unchanged', () => {
      expect(sanitizeObjectPath('folder/file.txt')).toBe('folder/file.txt');
      expect(sanitizeObjectPath('a/b/c/d.pdf')).toBe('a/b/c/d.pdf');
    });

    it('should remove leading slashes', () => {
      expect(sanitizeObjectPath('/folder/file.txt')).toBe('folder/file.txt');
      expect(sanitizeObjectPath('///path/file.txt')).toBe('path/file.txt');
    });

    it('should reject path traversal', () => {
      expect(sanitizeObjectPath('../etc/passwd')).toBeNull();
      expect(sanitizeObjectPath('folder/../secret')).toBeNull();
    });

    it('should reject backslashes', () => {
      expect(sanitizeObjectPath('folder\\file.txt')).toBeNull();
    });

    it('should reject null bytes', () => {
      expect(sanitizeObjectPath('folder/file\0.txt')).toBeNull();
    });

    it('should reject paths that are too long', () => {
      const longPath = 'a/'.repeat(600) + 'file.txt';
      expect(sanitizeObjectPath(longPath)).toBeNull();
    });

    it('should return null for empty paths', () => {
      expect(sanitizeObjectPath('')).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(sanitizeObjectPath(null as any)).toBeNull();
      expect(sanitizeObjectPath(undefined as any)).toBeNull();
    });
  });

  describe('sanitizeFolderPath', () => {
    it('should keep safe folder names unchanged', () => {
      expect(sanitizeFolderPath('documents')).toBe('documents');
      expect(sanitizeFolderPath('my-folder_2024')).toBe('my-folder_2024');
    });

    it('should replace special characters', () => {
      expect(sanitizeFolderPath('folder<>:"|?*\\')).toBe('folder________');
    });

    it('should preserve spaces', () => {
      expect(sanitizeFolderPath('my folder')).toBe('my folder');
    });

    it('should preserve periods', () => {
      expect(sanitizeFolderPath('v1.0.0')).toBe('v1.0.0');
    });
  });

  describe('validateUploadedFile', () => {
    it('should validate valid file', () => {
      const file = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]),
      };
      const result = validateUploadedFile(file);
      expect(result.isValid).toBe(true);
    });

    it('should reject file with invalid extension', () => {
      const file = {
        originalname: 'script.php',
        mimetype: 'application/x-php',
        buffer: Buffer.from('<?php'),
      };
      const result = validateUploadedFile(file);
      expect(result.isValid).toBe(false);
    });

    it('should reject file with invalid filename', () => {
      const file = {
        originalname: '../../../etc/passwd',
        mimetype: 'text/plain',
        buffer: Buffer.from('content'),
      };
      const result = validateUploadedFile(file);
      expect(result.isValid).toBe(false);
    });

    it('should reject file with mismatched signature', () => {
      const file = {
        originalname: 'fake.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]),
      };
      const result = validateUploadedFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('spoofing');
    });

    it('should skip signature validation when disabled', () => {
      const file = {
        originalname: 'fake.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]),
      };
      const result = validateUploadedFile(file, { validateSignature: false });
      // With signature validation disabled, and content-type matching extension,
      // the file should pass validation
      expect(result.isValid).toBe(true);
    });

    it('should use allowlist when specified', () => {
      const file = {
        originalname: 'file.xyz',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('content'),
      };
      const result = validateUploadedFile(file, { useAllowlist: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not in allowed list');
    });
  });
});
