/**
 * @fileoverview MinIO storage service for Knowledge Base document operations.
 * 
 * Provides API functions for interacting with MinIO object storage:
 * - Bucket management (list, add, remove configurations) - stored in database
 * - File operations (list, upload, download, delete) - directly from MinIO
 * - Folder management and batch operations
 * 
 * All operations require authentication and appropriate permissions.
 * Used by the Knowledge Base Documents page (MinIOManagerPage).
 * 
 * @module services/minioService
 */

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

/**
 * MinIO bucket configuration from the database.
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
 * File or folder object in MinIO.
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
    /** Full path prefix */
    prefix?: string;
}

/**
 * Data for adding a new bucket configuration.
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
 * Available bucket from MinIO (not yet configured).
 */
export interface AvailableBucket {
    /** MinIO bucket name */
    name: string;
    /** Creation timestamp */
    creationDate: string;
}

/**
 * Access Key (Service Account) details.
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
 * Custom error class for MinIO service errors.
 * Includes error code for handling specific error types.
 */
export class MinioServiceError extends Error {
    code?: string | undefined;

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
 * Fetch all configured buckets from database.
 * @returns Array of bucket configurations
 * @throws Error if fetch fails
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
 * Fetch available buckets from MinIO (not yet configured).
 * @returns Array of available buckets
 * @throws Error if fetch fails
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
 * Add a bucket configuration to database.
 * The bucket must already exist in MinIO.
 * @param bucket - Bucket configuration data
 * @returns Created bucket configuration
 * @throws Error if creation fails
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
 * Remove a bucket configuration from database.
 * This does NOT delete the bucket from MinIO.
 * @param bucketId - Bucket UUID to remove
 * @throws Error if removal fails
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
 * List objects in a bucket at the given prefix (realtime from MinIO).
 * @param bucketId - Bucket UUID
 * @param prefix - Path prefix (folder path)
 * @returns Array of file/folder objects
 * @throws MinioServiceError if listing fails (with error code for specific handling)
 */
export const listObjects = async (
    bucketId: string,
    prefix: string = ''
): Promise<FileObject[]> => {
    let url = `${API_BASE_URL}/api/minio/storage/${bucketId}/list`;
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
 * Upload files to a bucket.
 * Uses XMLHttpRequest for progress tracking.
 * 
 * @param bucketId - Bucket UUID
 * @param files - Array of File objects to upload
 * @param prefix - Optional path prefix
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload result from server
 * @throws Error if upload fails
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
    let uploadUrl = `${API_BASE_URL}/api/minio/storage/${bucketId}/upload`;
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
 * Create a folder in a bucket.
 * @param bucketId - Bucket UUID
 * @param folderName - Folder name to create
 * @param prefix - Parent folder prefix
 * @throws Error if creation fails
 */
export const createFolder = async (
    bucketId: string,
    folderName: string,
    prefix: string = ''
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/folder`, {
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
 * Delete a single file or folder.
 * @param bucketId - Bucket UUID
 * @param objectName - Full object path
 * @param isFolder - Whether the object is a folder
 * @throws Error if deletion fails
 */
export const deleteObject = async (
    bucketId: string,
    objectName: string,
    isFolder: boolean
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/delete`, {
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
 * Delete multiple files and/or folders.
 * @param bucketId - Bucket UUID
 * @param objects - Array of objects to delete with name and isFolder flag
 * @throws Error if deletion fails
 */
export const batchDelete = async (
    bucketId: string,
    objects: Array<{ name: string; isFolder: boolean }>
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/batch-delete`, {
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
 * Get a presigned download URL for a file.
 * URL is valid for 1 hour.
 * 
 * @param bucketId - Bucket UUID
 * @param objectPath - Full object path
 * @returns Presigned download URL
 * @throws Error if URL generation fails
 */
export const getDownloadUrl = async (bucketId: string, objectPath: string, preview: boolean = false): Promise<string> => {
    let url = `${API_BASE_URL}/api/minio/storage/${bucketId}/download/${objectPath}`;
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
 * Check if files exist in the bucket.
 * @param bucketId - Bucket UUID
 * @param files - Array of object paths
 * @returns Object containing exists array
 */
export const checkFilesExistence = async (
    bucketId: string,
    files: string[]
): Promise<{ exists: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/check-existence`, {
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
 * List all buckets directly from MinIO.
 * @returns Array of available buckets
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
 * Get statistics for a specific bucket.
 * @param bucketName - Name of the bucket
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
 * Create a new bucket directly in MinIO.
 * @param bucketName - Name of the new bucket
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
 * Delete a bucket directly from MinIO.
 * @param bucketName - Name of the bucket to delete
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
 * List all Access Keys.
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
 * Create a new Access Key.
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
 * Delete an Access Key.
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

