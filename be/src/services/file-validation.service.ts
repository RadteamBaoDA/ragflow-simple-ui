/**
 * @fileoverview File upload validation utilities.
 * 
 * Provides validation functions for secure file uploads based on
 * OWASP File Upload Cheat Sheet recommendations.
 * 
 * @module services/file-validation
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    MAX_FILENAME_LENGTH,
    MAX_PATH_LENGTH,
    DANGEROUS_EXTENSIONS,
    ALLOWED_DOCUMENT_EXTENSIONS,
    FILE_SIGNATURES,
    CONTENT_TYPE_EXTENSION_MAP,
} from '../config/file-upload.config.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationResult {
    isValid: boolean;
    error?: string | undefined;
    warning?: string | undefined;
}

export interface SanitizeResult {
    sanitized: string | null;
    error?: string | undefined;
}

// ============================================================================
// Extension Validation
// ============================================================================

/**
 * Validate file extension against allowlist and blocklist.
 * 
 * @param filename - The original filename
 * @param useAllowlist - If true, only allow extensions in ALLOWED_DOCUMENT_EXTENSIONS
 * @returns Validation result with error message if invalid
 */
export function validateFileExtension(filename: string, useAllowlist: boolean = false): ValidationResult {
    const ext = path.extname(filename).toLowerCase();
    
    // Check for empty extension
    if (!ext) {
        return { isValid: false, error: 'File must have an extension' };
    }
    
    // Check for double extensions (e.g., .jpg.php)
    const parts = filename.split('.');
    if (parts.length > 2) {
        for (let i = 1; i < parts.length; i++) {
            const partExt = '.' + parts[i]!.toLowerCase();
            if (DANGEROUS_EXTENSIONS.has(partExt)) {
                return { isValid: false, error: `File contains dangerous extension: ${partExt}` };
            }
        }
    }
    
    // Always block dangerous extensions
    if (DANGEROUS_EXTENSIONS.has(ext)) {
        return { isValid: false, error: `File type not allowed: ${ext}` };
    }
    
    // If using allowlist, check against allowed extensions
    if (useAllowlist && !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
        return { isValid: false, error: `File type not in allowed list: ${ext}` };
    }
    
    return { isValid: true };
}

// ============================================================================
// Content-Type Validation
// ============================================================================

/**
 * Validate Content-Type header matches file extension.
 * 
 * @param mimetype - The Content-Type from the upload
 * @param filename - The original filename
 * @returns Validation result with warning if mismatch
 */
export function validateContentType(mimetype: string, filename: string): ValidationResult {
    const ext = path.extname(filename).toLowerCase();
    const allowedExtensions = CONTENT_TYPE_EXTENSION_MAP[mimetype];
    
    // If we don't know this content type, log warning but allow
    if (!allowedExtensions) {
        return { 
            isValid: true, 
            warning: `Unknown Content-Type: ${mimetype} for file ${filename}` 
        };
    }
    
    // Check if extension matches content type
    if (!allowedExtensions.includes(ext)) {
        return { 
            isValid: false, 
            warning: `Content-Type ${mimetype} does not match extension ${ext}` 
        };
    }
    
    return { isValid: true };
}

// ============================================================================
// File Signature Validation
// ============================================================================

/**
 * Validate file signature (magic bytes) matches claimed extension.
 * 
 * @param buffer - The file content buffer
 * @param filename - The original filename
 * @returns Validation result with error if mismatch
 */
export function validateFileSignature(buffer: Buffer, filename: string): ValidationResult {
    const ext = path.extname(filename).toLowerCase();
    const expectedSignatures = FILE_SIGNATURES[ext];
    
    // If we don't have signatures for this type, allow
    if (!expectedSignatures) {
        return { isValid: true };
    }
    
    // Check if any of the expected signatures match
    for (const signature of expectedSignatures) {
        if (buffer.length >= signature.length) {
            const fileStart = buffer.subarray(0, signature.length);
            if (fileStart.equals(signature)) {
                return { isValid: true };
            }
        }
    }
    
    return { 
        isValid: false, 
        error: `File content does not match ${ext} file signature - possible file type spoofing` 
    };
}

// ============================================================================
// Filename Sanitization
// ============================================================================

/**
 * Sanitize and validate filename according to OWASP guidelines.
 * Supports Unicode characters (Japanese, Chinese, Vietnamese, etc.)
 * while blocking dangerous characters and path traversal.
 * 
 * @param filename - The original filename
 * @returns Sanitized filename or null if invalid
 */
export function sanitizeFilename(filename: string): SanitizeResult {
    if (!filename || typeof filename !== 'string') {
        return { sanitized: null, error: 'Filename is required' };
    }
    
    // Remove path components (prevent path traversal)
    let sanitized = path.basename(filename);
    
    // Check length (use Buffer to count bytes for UTF-8 safety)
    if (sanitized.length > MAX_FILENAME_LENGTH) {
        return { sanitized: null, error: `Filename too long (max ${MAX_FILENAME_LENGTH} characters)` };
    }
    
    // Block null bytes
    if (sanitized.includes('\0')) {
        return { sanitized: null, error: 'Filename contains null bytes' };
    }
    
    // Block path traversal sequences
    if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
        return { sanitized: null, error: 'Filename contains path traversal characters' };
    }
    
    // Remove dangerous control characters (ASCII 0-31 except tab, newline) and special chars
    // Keep: Unicode letters/numbers (\p{L}\p{N}), basic punctuation, space
    // Block: Control chars, path separators, shell metacharacters
    // Using Unicode-aware regex with 'u' flag
    sanitized = sanitized.replace(/[\x00-\x1f\x7f<>:"|?*\\]/gu, '_');
    
    // Prevent leading/trailing periods (hidden files, extension manipulation)
    sanitized = sanitized.replace(/^\.+|\.+$/g, '_');
    
    // Collapse multiple periods/underscores/hyphens
    sanitized = sanitized.replace(/[._-]{2,}/g, '_');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    if (!sanitized) {
        return { sanitized: null, error: 'Filename is empty after sanitization' };
    }
    
    return { sanitized };
}

/**
 * Generate a safe, unique filename with UUID.
 * Preserves original extension but replaces the base name.
 * 
 * @param originalFilename - The original filename (for extension)
 * @returns Safe filename with UUID
 */
export function generateSafeFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename).toLowerCase();
    const uuid = uuidv4();
    return `${uuid}${ext}`;
}

// ============================================================================
// Path Sanitization
// ============================================================================

/**
 * Validate and sanitize object path to prevent path traversal attacks.
 * 
 * @param objectPath - The object path to validate
 * @returns Sanitized path or null if invalid
 */
export function sanitizeObjectPath(objectPath: string): string | null {
    if (!objectPath || typeof objectPath !== 'string') return null;
    
    // Block path traversal attempts
    if (objectPath.includes('..') || objectPath.includes('\\')) {
        return null;
    }
    
    // Remove leading slashes
    let sanitized = objectPath.replace(/^\/+/, '');
    
    // Block null bytes
    if (sanitized.includes('\0')) {
        return null;
    }
    
    // Limit path length
    if (sanitized.length > MAX_PATH_LENGTH) {
        return null;
    }
    
    return sanitized;
}

/**
 * Sanitize folder path components.
 * Supports Unicode characters (Japanese, Chinese, Vietnamese, etc.)
 * while blocking dangerous characters.
 * 
 * @param folderPath - The folder path to sanitize
 * @returns Sanitized folder path
 */
export function sanitizeFolderPath(folderPath: string): string {
    // Remove dangerous control characters and special chars
    // Keep: Unicode letters/numbers, basic punctuation, space
    return folderPath.replace(/[\x00-\x1f\x7f<>:"|?*\\]/gu, '_');
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Perform all file validations in one call.
 * 
 * @param file - The uploaded file object
 * @param options - Validation options
 * @returns Combined validation result
 */
export function validateUploadedFile(
    file: { originalname: string; mimetype: string; buffer: Buffer },
    options: { useAllowlist?: boolean; validateSignature?: boolean } = {}
): ValidationResult {
    const { useAllowlist = false, validateSignature = true } = options;
    
    // 1. Validate filename
    const filenameResult = sanitizeFilename(file.originalname);
    if (!filenameResult.sanitized) {
        return { isValid: false, error: filenameResult.error };
    }
    
    // 2. Validate extension
    const extResult = validateFileExtension(file.originalname, useAllowlist);
    if (!extResult.isValid) {
        return extResult;
    }
    
    // 3. Validate Content-Type
    const contentTypeResult = validateContentType(file.mimetype, file.originalname);
    if (!contentTypeResult.isValid) {
        return contentTypeResult;
    }
    
    // 4. Validate file signature (if enabled and buffer available)
    if (validateSignature && file.buffer) {
        const signatureResult = validateFileSignature(file.buffer, file.originalname);
        if (!signatureResult.isValid) {
            return signatureResult;
        }
    }
    
    return { isValid: true, warning: contentTypeResult.warning };
}
