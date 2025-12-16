/**
 * @fileoverview File upload security configuration.
 * 
 * Centralized configuration for file upload validation based on
 * OWASP File Upload Cheat Sheet recommendations.
 * 
 * @module config/file-upload
 */

// ============================================================================
// Size Limits
// ============================================================================

/**
 * Maximum filename length to prevent filesystem issues and DoS.
 * Most filesystems support 255 bytes; we use 200 to be safe with UTF-8.
 */
export const MAX_FILENAME_LENGTH = 200;

/**
 * Maximum file size in bytes (500MB).
 */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * Maximum number of files per upload request.
 * Increased to support folder uploads while still providing DoS protection.
 */
export const MAX_FILES_PER_REQUEST = 1000;

/**
 * Maximum form field size in bytes (10MB).
 */
export const MAX_FIELD_SIZE = 10 * 1024 * 1024;

/**
 * Maximum object path length for MinIO.
 */
export const MAX_PATH_LENGTH = 1024;

// ============================================================================
// Extension Configuration
// ============================================================================

/**
 * Dangerous file extensions that should ALWAYS be blocked.
 * These can execute code or pose security risks on various systems.
 */
export const DANGEROUS_EXTENSIONS = new Set([
    // Executable files
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.msi', '.msp',
    // Script files
    '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
    // Compiled/bytecode
    '.dll', '.so', '.dylib', '.jar', '.class', '.war', '.ear',
    // Web shells and server-side scripts
    '.php', '.php3', '.php4', '.php5', '.php7', '.phtml', '.phar',
    '.asp', '.aspx', '.asa', '.asax', '.ascx', '.ashx', '.asmx',
    '.jsp', '.jspx', '.jsw', '.jsv', '.jspf',
    '.cgi', '.pl', '.py', '.pyc', '.pyo', '.rb',
    // Configuration files that could be dangerous
    '.htaccess', '.htpasswd', '.config', '.ini',
    // Office macros
    '.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm',
    // Links and shortcuts
    '.lnk', '.scf', '.url', '.desktop',
]);

/**
 * Allowed file extensions for document uploads.
 * Use this for strict allowlist mode.
 */
export const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
    // Audio/Video
    '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.avi', '.mov', '.mkv',
    // Archives (if needed)
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Data formats
    '.json', '.xml', '.yaml', '.yml',
]);

// ============================================================================
// File Signatures (Magic Bytes)
// ============================================================================

/**
 * File signature (magic bytes) database for common file types.
 * Used to validate that file content matches the claimed extension.
 * Key: extension, Value: array of possible magic byte signatures (hex)
 */
export const FILE_SIGNATURES: Record<string, Buffer[]> = {
    // Images
    '.jpg': [Buffer.from([0xFF, 0xD8, 0xFF])],
    '.jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
    '.png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    '.gif': [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
    '.bmp': [Buffer.from([0x42, 0x4D])],
    '.webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    '.ico': [Buffer.from([0x00, 0x00, 0x01, 0x00])],
    '.tiff': [Buffer.from([0x49, 0x49, 0x2A, 0x00]), Buffer.from([0x4D, 0x4D, 0x00, 0x2A])],
    '.tif': [Buffer.from([0x49, 0x49, 0x2A, 0x00]), Buffer.from([0x4D, 0x4D, 0x00, 0x2A])],

    // Documents
    '.pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
    '.doc': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])], // OLE Compound
    '.xls': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
    '.ppt': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
    '.docx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP-based
    '.xlsx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
    '.pptx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
    '.odt': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
    '.ods': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
    '.odp': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],

    // Archives
    '.zip': [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
    '.rar': [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07])],
    '.7z': [Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])],
    '.gz': [Buffer.from([0x1F, 0x8B])],
    '.tar': [Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72])],

    // Audio/Video
    '.mp3': [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xFA]), Buffer.from([0x49, 0x44, 0x33])],
    '.wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    '.mp4': [Buffer.from([0x00, 0x00, 0x00]), Buffer.from([0x66, 0x74, 0x79, 0x70])],
    '.webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
    '.avi': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    '.mkv': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
};

// ============================================================================
// Content-Type Mapping
// ============================================================================

/**
 * Content-Type to extension mapping for validation.
 */
export const CONTENT_TYPE_EXTENSION_MAP: Record<string, string[]> = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/bmp': ['.bmp'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'],
    'image/x-icon': ['.ico'],
    'image/tiff': ['.tiff', '.tif'],

    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    'application/vnd.oasis.opendocument.presentation': ['.odp'],
    'application/rtf': ['.rtf'],

    // Archives
    'application/zip': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/x-7z-compressed': ['.7z'],
    'application/gzip': ['.gz'],
    'application/x-tar': ['.tar'],

    // Audio/Video
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/ogg': ['.ogg'],
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/x-msvideo': ['.avi'],
    'video/quicktime': ['.mov'],
    'video/x-matroska': ['.mkv'],

    // Text/Data
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'application/x-yaml': ['.yaml', '.yml'],
    'text/yaml': ['.yaml', '.yml'],
};
