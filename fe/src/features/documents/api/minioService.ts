/**
 * @fileoverview MinIO storage service for Knowledge Base document operations.
 *
 * Provides API functions for interacting with MinIO object storage:
 * - Bucket management (list, add, remove configurations) - stored in database
 * - File operations (list, upload, download, delete) - directly from MinIO
 * - Folder management and batch operations
 *
 * All operations require authentication and appropriate permissions.
 * Used by the Knowledge Base Documents page (DocumentManagerPage).
 *
 * @module services/minioService
 */

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

/**
 * @description Enumeration of permission levels for storage access.
 */
export enum PermissionLevel {
    /** No access */
    NONE = 0,
    /** Read-only access */
    VIEW = 1,
    /** Upload and read access */
    UPLOAD = 2,
    /** Full control (delete, manage permissions) */
    FULL = 3
}

/**
 * @description Represents a storage permission record for a user or team.
 */
export interface StoragePermission {
    /** Unique permission ID */
    id: string;
    /** Type of entity the permission applies to (user or team) */
    entity_type: 'user' | 'team';
    /** ID of the user or team */
    entity_id: string;
    /** ID of the bucket this permission applies to */
    bucket_id: string;
    /** Level of access granted */
    permission_level: number;
    /** Creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
}

/**
 * @description MinIO bucket configuration as stored in the application database.
 */
export interface MinioBucket {
    /** Unique bucket ID (UUID) */
    id: string;
    /** MinIO bucket name (S3-compatible) */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Optional description */
    description?: string;
    /** User ID who created the bucket */
    created_by: string;
    /** Creation timestamp (ISO string) */
    created_at: string;
    /** Whether bucket is active */
    is_active: boolean;
}

/**
 * @description Represents a file or folder object returned from MinIO.
 */
export interface FileObject {
    /** Object name (file name or folder name) */
    name: string;
    /** File size in bytes */
    size: number;
    /** Last modified date */
    lastModified: Date;
    /** Object ETag (hash) */
    etag: string;
    /** Whether this is a folder */
    isFolder: boolean;
    /** Full path prefix used for listing */
    prefix?: string;
}

/**
 * @description Data transfer object for adding a new bucket configuration.
 */
export interface CreateBucketDto {
    /** MinIO bucket name (must exist in MinIO, follow S3 naming rules) */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Optional description */
    description?: string;
}

/**
 * @description Available bucket information directly from MinIO (not yet configured in app).
 */
export interface AvailableBucket {
    /** MinIO bucket name */
    name: string;
    /** Creation timestamp */
    creationDate: string;
}

/**
 * @description Access Key (Service Account) details.
 */
export interface AccessKey {
    accessKey: string;
    parentUser: string;
    accountStatus: string;
    name?: string;
    description?: string;
    expiration?: string;
}


/**
 * @description Custom error class for MinIO service errors.
 * Includes error code for handling specific error types.
 */
export class MinioServiceError extends Error {
    /** Optional error code string */
    code?: string | undefined;

    /**
     * @param {string} message - Error message.
     * @param {string} [code] - Error code.
     */
    constructor(message: string, code?: string | undefined) {
        super(message);
        this.code = code;
        this.name = 'MinioServiceError';
    }
}

// ============================================================================
// Bucket Operations
// ============================================================================

/**
 * @description Fetch all configured buckets from database.
 * @returns {Promise<MinioBucket[]>} Array of bucket configurations.
 * @throws {Error} If fetch fails.
 */
export const getBuckets = async (): Promise<MinioBucket[]> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch buckets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.buckets;
};

/**
 * @description Fetch available buckets from MinIO (not yet configured).
 * @returns {Promise<AvailableBucket[]>} Array of available buckets.
 * @throws {Error} If fetch fails.
 */
export const getAvailableBuckets = async (): Promise<AvailableBucket[]> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets/available/list`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch available buckets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.buckets;
};

/**
 * @description Add a bucket configuration to database.
 * The bucket must already exist in MinIO.
 *
 * @param {CreateBucketDto} bucket - Bucket configuration data.
 * @returns {Promise<MinioBucket>} Created bucket configuration.
 * @throws {Error} If creation fails.
 */
export const createBucket = async (bucket: CreateBucketDto): Promise<MinioBucket> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bucket),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add bucket configuration');
    }

    const data = await response.json();
    return data.bucket;
};

/**
 * @description Remove a bucket configuration from database.
 * This does NOT delete the bucket from MinIO.
 *
 * @param {string} bucketId - Bucket UUID to remove.
 * @returns {Promise<void>}
 * @throws {Error} If removal fails.
 */
export const deleteBucket = async (bucketId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets/${bucketId}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove bucket configuration');
    }
};

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * @description List objects in a bucket at the given prefix (realtime from MinIO).
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {string} [prefix=''] - Path prefix (folder path).
 * @returns {Promise<FileObject[]>} Array of file/folder objects.
 * @throws {MinioServiceError} If listing fails (with error code for specific handling).
 */
export const listObjects = async (
    bucketId: string,
    prefix: string = ''
): Promise<FileObject[]> => {
    let url = `${API_BASE_URL}/api/minio/documents/${bucketId}/list`;
    if (prefix) {
        url += `?prefix=${encodeURIComponent(prefix)}`;
    }

    const response = await fetch(url, {
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new MinioServiceError(
            errorData.message || errorData.error || `Failed to list objects: ${response.statusText}`,
            errorData.code
        );
        throw error;
    }

    const data = await response.json();
    return data.objects;
};

/**
 * @description Upload files to a bucket.
 * Uses XMLHttpRequest for progress tracking.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {File[]} files - Array of File objects to upload.
 * @param {string} [prefix=''] - Optional path prefix.
 * @param {(progress: number) => void} [onProgress] - Optional callback for upload progress (0-100).
 * @param {boolean} [preserveFolderStructure=false] - Whether to preserve relative paths from drag-and-drop.
 * @returns {Promise<any>} Upload result from server.
 * @throws {Error} If upload fails.
 */
export const uploadFiles = async (
    bucketId: string,
    files: File[],
    prefix: string = '',
    onProgress?: (progress: number) => void,
    preserveFolderStructure: boolean = false
): Promise<any> => {
    // Build FormData with files
    const formData = new FormData();

    files.forEach((file) => {
        formData.append('files', file);
        // If preserving folder structure, send the relative path
        if (preserveFolderStructure && (file as any).webkitRelativePath) {
            formData.append('filePaths', (file as any).webkitRelativePath);
        }
    });

    if (preserveFolderStructure) {
        formData.append('preserveFolderStructure', 'true');
    }

    // Build URL with prefix as query parameter (backend expects it in query string)
    let uploadUrl = `${API_BASE_URL}/api/minio/documents/${bucketId}/upload`;
    if (prefix) {
        uploadUrl += `?prefix=${encodeURIComponent(prefix)}`;
    }

    // Use XHR for progress tracking (fetch doesn't support upload progress)
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 201) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });

        xhr.open('POST', uploadUrl);
        xhr.withCredentials = true;
        xhr.send(formData);
    });
};

/**
 * @description Create a folder in a bucket.
 * Folder creation in MinIO usually means creating a zero-byte object ending in '/'.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {string} folderName - Folder name to create.
 * @param {string} [prefix=''] - Parent folder prefix.
 * @returns {Promise<void>}
 * @throws {Error} If creation fails.
 */
export const createFolder = async (
    bucketId: string,
    folderName: string,
    prefix: string = ''
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/documents/${bucketId}/folder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            folderName,
            prefix,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create folder');
    }
};

/**
 * @description Delete a single file or folder.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {string} objectName - Full object path.
 * @param {boolean} isFolder - Whether the object is a folder.
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails.
 */
export const deleteObject = async (
    bucketId: string,
    objectName: string,
    isFolder: boolean
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/documents/${bucketId}/delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            path: objectName,
            isFolder: isFolder,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete object');
    }
};

/**
 * @description Delete multiple files and/or folders.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {Array<{ name: string; isFolder: boolean }>} objects - Array of objects to delete.
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails.
 */
export const batchDelete = async (
    bucketId: string,
    objects: Array<{ name: string; isFolder: boolean }>
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/documents/${bucketId}/batch-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            items: objects.map(obj => ({
                path: obj.name,
                isFolder: obj.isFolder
            }))
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to batch delete');
    }
};

/**
 * @description Get a presigned download URL for a file.
 * URL is valid for 1 hour.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {string} objectPath - Full object path.
 * @param {boolean} [preview=false] - Whether to generate a preview URL (Content-Disposition: inline).
 * @returns {Promise<string>} Presigned download URL.
 * @throws {Error} If URL generation fails.
 */
export const getDownloadUrl = async (bucketId: string, objectPath: string, preview: boolean = false): Promise<string> => {
    let url = `${API_BASE_URL}/api/minio/documents/${bucketId}/download/${objectPath}`;
    if (preview) {
        url += '?preview=true';
    }

    const response = await fetch(
        url,
        {
            credentials: 'include',
        }
    );

    if (!response.ok) {
        throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.download_url;
};

/**
 * @description Check if files exist in the bucket.
 *
 * @param {string} bucketId - Bucket UUID.
 * @param {string[]} files - Array of object paths.
 * @returns {Promise<{ exists: string[] }>} Object containing list of existing files.
 * @throws {Error} If check fails.
 */
export const checkFilesExistence = async (
    bucketId: string,
    files: string[]
): Promise<{ exists: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/documents/${bucketId}/check-existence`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ files }),
    });

    if (!response.ok) {
        throw new Error('Failed to check file existence');
    }

    const data = await response.json();
    return data;
};

// ============================================================================
// Raw MinIO Operations (Admin only)
// ============================================================================

/**
 * @description List all buckets directly from MinIO (Admin only).
 * @returns {Promise<any[]>} Array of available buckets.
 * @throws {Error} If fetch fails.
 */
export const getRawBuckets = async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch raw buckets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.buckets;
};

/**
 * @description Get statistics for a specific bucket (Admin only).
 * @param {string} bucketName - Name of the bucket.
 * @returns {Promise<{ objectCount: number; totalSize: number }>} Bucket stats.
 * @throws {Error} If fetch fails.
 */
export const getRawBucketStats = async (bucketName: string): Promise<{ objectCount: number; totalSize: number }> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/${bucketName}/stats`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch bucket stats: ${response.statusText}`);
    }

    const data = await response.json();
    return data.stats;
};

/**
 * @description Create a new bucket directly in MinIO (Admin only).
 * @param {string} bucketName - Name of the new bucket.
 * @returns {Promise<void>}
 * @throws {Error} If creation fails.
 */
export const createRawBucket = async (bucketName: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: bucketName }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bucket');
    }
};

/**
 * @description Delete a bucket directly from MinIO (Admin only).
 * @param {string} bucketName - Name of the bucket to delete.
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails.
 */
export const deleteRawBucket = async (bucketName: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/${bucketName}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete bucket');
    }
};

/**
 * @description Get global MinIO statistics (Admin only).
 * @returns {Promise<object>} Object containing global metrics, distribution, and top items.
 * @throws {Error} If fetch fails.
 */
export const getRawGlobalStats = async (): Promise<{
    totalBuckets: number;
    totalObjects: number;
    totalSize: number;
    distribution: Record<string, number>;
    topBuckets: { name: string; size: number; objectCount: number }[];
    topFiles: { name: string; size: number; lastModified: Date; bucketName: string }[];
}> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/metrics`, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch global stats');
    }
    return response.json();
};

/**
 * @description List all Access Keys (Admin only).
 * @returns {Promise<AccessKey[]>} List of access keys.
 * @throws {Error} If fetch fails.
 */
export const getAccessKeys = async (): Promise<AccessKey[]> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/keys`, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch access keys');
    }
    const data = await response.json();
    return data.keys;
};

/**
 * @description Create a new Access Key (Admin only).
 * @param {string} policy - IAM policy for the key.
 * @param {string} [name] - Optional name for the key.
 * @param {string} [description] - Optional description.
 * @returns {Promise<any>} The created key details.
 * @throws {Error} If creation fails.
 */
export const createAccessKey = async (policy: string, name?: string, description?: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ policy, name, description }),
    });
    if (!response.ok) {
        throw new Error('Failed to create access key');
    }
    return response.json();
};

/**
 * @description Delete an Access Key (Admin only).
 * @param {string} accessKey - The access key ID to delete.
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails.
 */
export const deleteAccessKey = async (accessKey: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/raw/keys/${accessKey}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to delete access key');
    }
};

// ============================================================================
// Storage Permissions
// ============================================================================

/**
 * @description Get the effective storage permission level for the current user.
 *
 * @param {string} bucketId - Bucket UUID.
 * @returns {Promise<number>} Permission level.
 * @throws {Error} If resolution fails.
 */
export const getEffectivePermission = async (bucketId: string): Promise<number> => {
    const response = await fetch(`${API_BASE_URL}/api/document-permissions/resolve?bucketId=${bucketId}`, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to resolve permission');
    }
    const data = await response.json();
    return data.level;
};

/**
 * @description Get all configured storage permissions (Admin only).
 *
 * @param {string} [bucketId] - Optional bucket ID to filter by.
 * @returns {Promise<StoragePermission[]>} List of permissions.
 * @throws {Error} If fetch fails.
 */
export const getAllPermissions = async (bucketId?: string): Promise<StoragePermission[]> => {
    const url = bucketId
        ? `${API_BASE_URL}/api/document-permissions?bucketId=${bucketId}`
        : `${API_BASE_URL}/api/document-permissions`;
    const response = await fetch(url, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch permissions');
    }
    return response.json();
};

/**
 * @description Set storage permission for a user or team.
 *
 * @param {'user' | 'team'} entityType - Type of entity.
 * @param {string} entityId - Entity ID.
 * @param {string} bucketId - Bucket UUID.
 * @param {number} level - Permission level.
 * @returns {Promise<void>}
 * @throws {Error} If setting permission fails.
 */
export const setPermission = async (entityType: 'user' | 'team', entityId: string, bucketId: string, level: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/document-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entityType, entityId, bucketId, level }),
    });
    if (!response.ok) {
        throw new Error('Failed to set permission');
    }
};
