/**
 * @fileoverview Tests for MinIO storage service.
 *
 * Tests:
 * - Bucket operations (list, create, delete)
 * - Storage operations (list, upload, download, delete)
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBuckets,
  getAvailableBuckets,
  createBucket,
  deleteBucket,
  listObjects,
  uploadFiles,
  createFolder,
  deleteObject,
  batchDelete,
  getDownloadUrl,
  type MinioBucket,
  type AvailableBucket,
  type FileObject,
} from '@/features/documents/api/minioService';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Helper Functions
// ============================================================================

function createMockResponse(data: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockBucket: MinioBucket = {
  id: 'bucket-123',
  bucket_name: 'test-bucket',
  display_name: 'Test Bucket',
  description: 'A test bucket',
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  is_active: true,
};

const mockAvailableBucket: AvailableBucket = {
  name: 'available-bucket',
  creationDate: '2024-01-01T00:00:00Z',
};

const mockFileObject: FileObject = {
  name: 'test-file.pdf',
  size: 1024,
  lastModified: new Date('2024-01-01'),
  etag: 'abc123',
  isFolder: false,
  prefix: '',
};

// ============================================================================
// Tests
// ============================================================================

describe('minioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Bucket Operations
  // ==========================================================================

  describe('getBuckets', () => {
    it('should fetch all configured buckets', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ buckets: [mockBucket] })
      );

      const result = await getBuckets();

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/buckets', {
        credentials: 'include',
      });
      expect(result).toEqual([mockBucket]);
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 500, 'Internal Server Error')
      );

      await expect(getBuckets()).rejects.toThrow('Failed to fetch buckets: Internal Server Error');
    });

    it('should return empty array when no buckets', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ buckets: [] }));

      const result = await getBuckets();

      expect(result).toEqual([]);
    });
  });

  describe('getAvailableBuckets', () => {
    it('should fetch available buckets from MinIO', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ buckets: [mockAvailableBucket] })
      );

      const result = await getAvailableBuckets();

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/buckets/available/list', {
        credentials: 'include',
      });
      expect(result).toEqual([mockAvailableBucket]);
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 500, 'Internal Server Error')
      );

      await expect(getAvailableBuckets()).rejects.toThrow(
        'Failed to fetch available buckets: Internal Server Error'
      );
    });
  });

  describe('createBucket', () => {
    it('should create bucket configuration', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ bucket: mockBucket })
      );

      const createDto = {
        bucket_name: 'test-bucket',
        display_name: 'Test Bucket',
        description: 'A test bucket',
      };

      const result = await createBucket(createDto);

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createDto),
      });
      expect(result).toEqual(mockBucket);
    });

    it('should throw error with server message on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Bucket already exists' }),
      });

      await expect(
        createBucket({ bucket_name: 'test', display_name: 'Test' })
      ).rejects.toThrow('Bucket already exists');
    });

    it('should throw default error when no error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(
        createBucket({ bucket_name: 'test', display_name: 'Test' })
      ).rejects.toThrow('Failed to add bucket configuration');
    });
  });

  describe('deleteBucket', () => {
    it('should delete bucket configuration', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await deleteBucket('bucket-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/buckets/bucket-123', {
        method: 'DELETE',
        credentials: 'include',
      });
    });

    it('should throw error with server message on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Bucket not found' }),
      });

      await expect(deleteBucket('bucket-123')).rejects.toThrow('Bucket not found');
    });
  });

  // ==========================================================================
  // Storage Operations
  // ==========================================================================

  describe('listObjects', () => {
    it('should list objects in bucket root', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ objects: [mockFileObject] })
      );

      const result = await listObjects('bucket-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/list', {
        credentials: 'include',
      });
      expect(result).toEqual([mockFileObject]);
    });

    it('should list objects with prefix', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ objects: [mockFileObject] })
      );

      await listObjects('bucket-123', 'folder/subfolder/');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/minio/documents/bucket-123/list?prefix=folder%2Fsubfolder%2F',
        { credentials: 'include' }
      );
    });

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({}, false, 500, 'Internal Server Error')
      );

      await expect(listObjects('bucket-123')).rejects.toThrow(
        'Failed to list objects: Internal Server Error'
      );
    });
  });

  describe('uploadFiles', () => {
    // Note: Testing XMLHttpRequest is complex due to its async nature.
    // These tests verify the function signature and FormData construction.

    it('should create FormData with files', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      // Mock XHR to simulate successful upload
      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn((formData: FormData) => {
          // Verify FormData contents
          expect(formData.get('files')).toBe(mockFile);
        }),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 200;
              xhrInstance.responseText = JSON.stringify({ success: true });
              handler();
            }, 0);
          }
        }),
        status: 200,
        statusText: 'OK',
        responseText: '{}',
      };

      // Use function constructor for proper 'new' support
      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      const result = await uploadFiles('bucket-123', [mockFile]);

      expect(xhrInstance.open).toHaveBeenCalledWith(
        'POST',
        '/api/minio/documents/bucket-123/upload'
      );
      expect(xhrInstance.withCredentials).toBe(true);
      expect(result).toEqual({ success: true });
    });

    it('should include prefix in FormData', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      let capturedFormData: FormData | undefined;

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn((formData: FormData) => {
          capturedFormData = formData;
        }),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 200;
              xhrInstance.responseText = '{}';
              handler();
            }, 0);
          }
        }),
        status: 200,
        statusText: 'OK',
        responseText: '{}',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await uploadFiles('bucket-123', [mockFile], 'folder/');

      expect(capturedFormData).toBeDefined();
      expect(capturedFormData!.get('prefix')).toBe('folder/');
    });

    it('should include preserveFolderStructure in FormData when enabled', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      let capturedFormData: FormData | undefined;

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn((formData: FormData) => {
          capturedFormData = formData;
        }),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 200;
              xhrInstance.responseText = '{}';
              handler();
            }, 0);
          }
        }),
        status: 200,
        statusText: 'OK',
        responseText: '{}',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await uploadFiles('bucket-123', [mockFile], '', undefined, true);

      expect(capturedFormData).toBeDefined();
      expect(capturedFormData!.get('preserveFolderStructure')).toBe('true');
    });

    it('should include file paths when preserveFolderStructure is enabled and file has webkitRelativePath', async () => {
      // Create mock file with webkitRelativePath
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' }) as any;
      mockFile.webkitRelativePath = 'folder/subfolder/test.txt';

      let capturedFormData: FormData | undefined;

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn((formData: FormData) => {
          capturedFormData = formData;
        }),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 200;
              xhrInstance.responseText = '{}';
              handler();
            }, 0);
          }
        }),
        status: 200,
        statusText: 'OK',
        responseText: '{}',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await uploadFiles('bucket-123', [mockFile], '', undefined, true);

      expect(capturedFormData).toBeDefined();
      expect(capturedFormData!.get('filePaths')).toBe('folder/subfolder/test.txt');
      expect(capturedFormData!.get('preserveFolderStructure')).toBe('true');
    });

    it('should call onProgress callback', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const onProgress = vi.fn();

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn(),
        withCredentials: false,
        upload: {
          addEventListener: vi.fn((event: string, handler: (e: { lengthComputable: boolean; loaded: number; total: number }) => void) => {
            if (event === 'progress') {
              setTimeout(() => {
                handler({ lengthComputable: true, loaded: 50, total: 100 });
              }, 0);
            }
          }),
        },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 200;
              xhrInstance.responseText = '{}';
              handler();
            }, 10);
          }
        }),
        status: 200,
        statusText: 'OK',
        responseText: '{}',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await uploadFiles('bucket-123', [mockFile], '', onProgress);

      expect(onProgress).toHaveBeenCalledWith(50);
    });

    it('should reject on HTTP error status', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn(),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(() => {
              xhrInstance.status = 500;
              xhrInstance.statusText = 'Internal Server Error';
              handler();
            }, 0);
          }
        }),
        status: 500,
        statusText: 'Internal Server Error',
        responseText: '',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await expect(uploadFiles('bucket-123', [mockFile])).rejects.toThrow(
        'Upload failed: Internal Server Error'
      );
    });

    it('should reject on network error', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      const xhrInstance = {
        open: vi.fn(),
        send: vi.fn(),
        withCredentials: false,
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'error') {
            setTimeout(handler, 0);
          }
        }),
        status: 0,
        statusText: '',
        responseText: '',
      };

      global.XMLHttpRequest = function () { return xhrInstance; } as any;

      await expect(uploadFiles('bucket-123', [mockFile])).rejects.toThrow('Upload failed');
    });
  });

  describe('createFolder', () => {
    it('should create folder in bucket', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await createFolder('bucket-123', 'new-folder');

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder_name: 'new-folder', prefix: '' }),
      });
    });

    it('should create folder with prefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await createFolder('bucket-123', 'subfolder', 'parent/');

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder_name: 'subfolder', prefix: 'parent/' }),
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Folder already exists' }),
      });

      await expect(createFolder('bucket-123', 'existing')).rejects.toThrow(
        'Folder already exists'
      );
    });
  });

  describe('deleteObject', () => {
    it('should delete a file', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await deleteObject('bucket-123', 'path/to/file.txt', false);

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: 'path/to/file.txt', isFolder: false }),
      });
    });

    it('should delete a folder', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await deleteObject('bucket-123', 'path/to/folder/', true);

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: 'path/to/folder/', isFolder: true }),
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Object not found' }),
      });

      await expect(deleteObject('bucket-123', 'missing.txt', false)).rejects.toThrow(
        'Object not found'
      );
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple objects', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      const objects = [
        { name: 'file1.txt', isFolder: false },
        { name: 'folder/', isFolder: true },
      ];

      await batchDelete('bucket-123', objects);

      expect(mockFetch).toHaveBeenCalledWith('/api/minio/documents/bucket-123/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: [
            { path: 'file1.txt', isFolder: false },
            { path: 'folder/', isFolder: true },
          ],
        }),
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Partial delete failed' }),
      });

      await expect(batchDelete('bucket-123', [{ name: 'file.txt', isFolder: false }])).rejects.toThrow(
        'Partial delete failed'
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should get presigned download URL', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ download_url: 'https://minio.example.com/bucket/file.pdf?token=abc' })
      );

      const result = await getDownloadUrl('bucket-123', 'path/to/file.pdf');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/minio/documents/bucket-123/download/path/to/file.pdf',
        { credentials: 'include' }
      );
      expect(result).toBe('https://minio.example.com/bucket/file.pdf?token=abc');
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, false, 404, 'Not Found'));

      await expect(getDownloadUrl('bucket-123', 'missing.pdf')).rejects.toThrow(
        'Failed to get download URL'
      );
    });
  });
});
