/**
 * @module services/file-validation
 * @description Provides validation functions for secure file uploads based on OWASP File Upload Cheat Sheet.
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
} from '@/config/file-upload.config.js';

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
 * @param filename - The original filename.
 * @param useAllowlist - If true, restricts to allowed extensions only.
 * @returns ValidationResult - Result indicating if extension is valid.
 * @description Checks against dangerous extensions and optionally enforces an allowlist.
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
        // Iterate parts to find dangerous extensions embedded in filename
        for (let i = 1; i < parts.length; i++) {
            const partExt = '.' + parts[i]!.toLowerCase();
            if (DANGEROUS_EXTENSIONS.has(partExt)) {
                return { isValid: false, error: `File contains dangerous extension: ${partExt}` };
            }
        }
    }

    // Always block dangerous extensions from main extension
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
 * @param mimetype - The Content-Type from the upload header.
 * @param filename - The original filename.
 * @returns ValidationResult - Result indicating if mime type matches extension.
 * @description Ensures the declared Content-Type aligns with the file extension to prevent spoofing.
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
 * @param buffer - The file content buffer.
 * @param filename - The original filename.
 * @returns ValidationResult - Result indicating if signature matches.
 * @description Inspects file header bytes to verify file type authenticity.
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
            // Compare bytes
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
 * @param filename - The original filename.
 * @returns SanitizeResult - Object containing sanitized filename or error.
 * @description Removes dangerous characters, path traversal patterns, and enforces length limits while supporting Unicode.
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

    // Remove dangerous control characters and special chars using Unicode-aware regex
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
 * @param originalFilename - The original filename.
 * @returns string - safe filename.
 * @description Preserves original extension but replaces the base name with a UUID.
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
 * @param objectPath - The object path to validate.
 * @returns string | null - Sanitized path or null if invalid.
 * @description Checks for directory traversal and control characters in file paths.
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
 * @param folderPath - The folder path to sanitize.
 * @returns string - Sanitized folder path.
 * @description Cleans folder names of dangerous characters while supporting Unicode.
 */
export function sanitizeFolderPath(folderPath: string): string {
    // Remove dangerous control characters and special chars
    return folderPath.replace(/[\x00-\x1f\x7f<>:"|?*\\]/gu, '_');
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Perform all file validations in one call.
 * @param file - The uploaded file object (name, mime, buffer).
 * @param options - Validation configuration choices.
 * @returns ValidationResult - Composite result of all checks.
 * @description Runs all validation steps: sanitization, extension, content-type, and signature.
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

    // 4. Validate file signature if buffer provided
    if (validateSignature && file.buffer) {
        const signatureResult = validateFileSignature(file.buffer, file.originalname);
        if (!signatureResult.isValid) {
            return signatureResult;
        }
    }

    return { isValid: true, warning: contentTypeResult.warning };
}
