/**
 * @fileoverview Unit tests for file upload configuration.
 * 
 * Tests constants, file signatures, and content-type mappings.
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE,
  MAX_FILES_PER_REQUEST,
  MAX_FIELD_SIZE,
  MAX_PATH_LENGTH,
  DANGEROUS_EXTENSIONS,
  ALLOWED_DOCUMENT_EXTENSIONS,
  FILE_SIGNATURES,
  CONTENT_TYPE_EXTENSION_MAP,
} from '../../src/shared/config/file-upload.config.js';

describe('File Upload Configuration', () => {
  describe('Size Constants', () => {
    it('MAX_FILENAME_LENGTH should be 200', () => {
      expect(MAX_FILENAME_LENGTH).toBe(200);
    });

    it('MAX_FILE_SIZE should be 500MB', () => {
      expect(MAX_FILE_SIZE).toBe(500 * 1024 * 1024);
    });

    it('MAX_FILES_PER_REQUEST should be 1000', () => {
      expect(MAX_FILES_PER_REQUEST).toBe(1000);
    });

    it('MAX_FIELD_SIZE should be 10MB', () => {
      expect(MAX_FIELD_SIZE).toBe(10 * 1024 * 1024);
    });

    it('MAX_PATH_LENGTH should be 1024', () => {
      expect(MAX_PATH_LENGTH).toBe(1024);
    });
  });

  describe('DANGEROUS_EXTENSIONS', () => {
    it('should be a Set', () => {
      expect(DANGEROUS_EXTENSIONS).toBeInstanceOf(Set);
    });

    it('should contain executable extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.exe')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.bat')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.cmd')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.com')).toBe(true);
    });

    it('should contain script extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.sh')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.bash')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.ps1')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.vbs')).toBe(true);
    });

    it('should contain web shell extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.php')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.phtml')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.asp')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.aspx')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.jsp')).toBe(true);
    });

    it('should contain compiled file extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.dll')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.so')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.jar')).toBe(true);
    });

    it('should contain Office macro extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.docm')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.xlsm')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.pptm')).toBe(true);
    });

    it('should contain dangerous config extensions', () => {
      expect(DANGEROUS_EXTENSIONS.has('.htaccess')).toBe(true);
      expect(DANGEROUS_EXTENSIONS.has('.htpasswd')).toBe(true);
    });
  });

  describe('ALLOWED_DOCUMENT_EXTENSIONS', () => {
    it('should be a Set', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS).toBeInstanceOf(Set);
    });

    it('should contain document extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.pdf')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.doc')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.docx')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.xls')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.xlsx')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.ppt')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.pptx')).toBe(true);
    });

    it('should contain image extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.jpg')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.jpeg')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.png')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.gif')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.webp')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.bmp')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.ico')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.tiff')).toBe(true);
    });

    it('should contain archive extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.zip')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.rar')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.7z')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.tar')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.gz')).toBe(true);
    });

    it('should contain text/data extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.txt')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.csv')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.json')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.xml')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.yaml')).toBe(true);
    });

    it('should contain audio/video extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.mp3')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.wav')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.ogg')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.mp4')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.webm')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.avi')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.mov')).toBe(true);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.mkv')).toBe(true);
    });

    it('should NOT contain dangerous extensions', () => {
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.exe')).toBe(false);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.php')).toBe(false);
      expect(ALLOWED_DOCUMENT_EXTENSIONS.has('.sh')).toBe(false);
    });
  });

  describe('FILE_SIGNATURES', () => {
    it('should contain JPEG signature', () => {
      const jpgSig = FILE_SIGNATURES['.jpg'];
      expect(jpgSig).toBeDefined();
      expect(jpgSig![0]).toEqual(Buffer.from([0xFF, 0xD8, 0xFF]));
    });

    it('should contain PNG signature', () => {
      const pngSig = FILE_SIGNATURES['.png'];
      expect(pngSig).toBeDefined();
      expect(pngSig![0]).toEqual(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    });

    it('should contain GIF signatures', () => {
      const gifSig = FILE_SIGNATURES['.gif'];
      expect(gifSig).toBeDefined();
      expect(gifSig!.length).toBe(2); // GIF87a and GIF89a
    });

    it('should contain PDF signature', () => {
      const pdfSig = FILE_SIGNATURES['.pdf'];
      expect(pdfSig).toBeDefined();
      expect(pdfSig![0]).toEqual(Buffer.from([0x25, 0x50, 0x44, 0x46])); // %PDF
    });

    it('should contain ZIP signature (for docx, xlsx, etc.)', () => {
      const zipSig = FILE_SIGNATURES['.zip'];
      expect(zipSig).toBeDefined();
      expect(zipSig![0]).toEqual(Buffer.from([0x50, 0x4B, 0x03, 0x04])); // PK
    });

    it('should have same signature for docx/xlsx/pptx (ZIP-based)', () => {
      const docxSig = FILE_SIGNATURES['.docx'];
      const xlsxSig = FILE_SIGNATURES['.xlsx'];
      const pptxSig = FILE_SIGNATURES['.pptx'];
      expect(docxSig).toEqual(xlsxSig);
      expect(xlsxSig).toEqual(pptxSig);
    });
  });

  describe('CONTENT_TYPE_EXTENSION_MAP', () => {
    it('should map image/jpeg to jpg and jpeg extensions', () => {
      const extensions = CONTENT_TYPE_EXTENSION_MAP['image/jpeg'];
      expect(extensions).toContain('.jpg');
      expect(extensions).toContain('.jpeg');
    });

    it('should map image/png to png extension', () => {
      const extensions = CONTENT_TYPE_EXTENSION_MAP['image/png'];
      expect(extensions).toContain('.png');
    });

    it('should map application/pdf to pdf extension', () => {
      const extensions = CONTENT_TYPE_EXTENSION_MAP['application/pdf'];
      expect(extensions).toContain('.pdf');
    });

    it('should map Office document types correctly', () => {
      const docxMap = CONTENT_TYPE_EXTENSION_MAP['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const xlsxMap = CONTENT_TYPE_EXTENSION_MAP['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const pptxMap = CONTENT_TYPE_EXTENSION_MAP['application/vnd.openxmlformats-officedocument.presentationml.presentation'];
      
      expect(docxMap).toContain('.docx');
      expect(xlsxMap).toContain('.xlsx');
      expect(pptxMap).toContain('.pptx');
    });

    it('should map text/plain to txt extension', () => {
      const extensions = CONTENT_TYPE_EXTENSION_MAP['text/plain'];
      expect(extensions).toContain('.txt');
    });

    it('should map application/json to json extension', () => {
      const extensions = CONTENT_TYPE_EXTENSION_MAP['application/json'];
      expect(extensions).toContain('.json');
    });

    it('should map archive types correctly', () => {
      const zipMap = CONTENT_TYPE_EXTENSION_MAP['application/zip'];
      const gzipMap = CONTENT_TYPE_EXTENSION_MAP['application/gzip'];
      
      expect(zipMap).toContain('.zip');
      expect(gzipMap).toContain('.gz');
    });
  });
});
