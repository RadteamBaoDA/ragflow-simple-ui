/**
 * @fileoverview Knowledge Base Documents page (Documents storage manager).
 * 
 * File manager interface for document storage using MinIO:
 * - Browse document buckets (configurations stored in database)
 * - Browse file and folders in realtime from Documents Storage
 * - Upload files with progress indicator
 * - Download files
 * - Delete files and folders (single and batch)
 * - Navigate folder hierarchy with i18n support
 * 
 * Available to admins and managers.
 * 
 * @module pages/DocumentManagerPage
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    Table,
    Input,
    Button,
    Space,
    Tooltip,
    App,
    Dropdown
} from 'antd';
import {
    HardDrive,
    Trash2,
    Upload,
    Download,
    AlertCircle,
    RefreshCw,
    FolderPlus,
    X,
    ChevronDown,
    ChevronRight,
    Home,
    ArrowLeft,
    ArrowRight,
    Search,
    Eye,
    FileText,
    FileImage,
    FileSpreadsheet,
    FileCode,
    File as FileIcon,
    Filter
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Select } from '@/components/Select';
import { FilePreviewModal } from '@/features/documents/components/FilePreview/FilePreviewModal';
import {
    DocumentBucket,
    FileObject,
    getBuckets,
    listObjects,
    uploadFiles,
    createFolder,
    deleteObject,
    batchDelete,
    getDownloadUrl,
    checkFilesExistence,
    DocumentServiceError,
    PermissionLevel,
    getEffectivePermission
} from '../api/documentService';
import { formatFileSize } from '@/utils/format';
import { useConfirm } from '@/components/ConfirmDialog';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const STORAGE_KEY_SELECTED_BUCKET = 'document_selected_bucket';

const FILE_CATEGORIES = {
    doc: { labelKey: 'documents.category.doc', extensions: ['doc', 'docx', 'odt', 'rtf', 'tex', 'wpd'] },
    excel: { labelKey: 'documents.category.excel', extensions: ['xls', 'xlsx', 'csv', 'ods', 'tsv'] },
    ppt: { labelKey: 'documents.category.ppt', extensions: ['ppt', 'pptx', 'odp', 'pps', 'ppsx'] },
    pdf: { labelKey: 'documents.category.pdf', extensions: ['pdf'] },
    text: { labelKey: 'documents.category.text', extensions: ['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf'] },
    image: { labelKey: 'documents.category.image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'ico'] },
    code: { labelKey: 'documents.category.code', extensions: ['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'go', 'rs', 'rb', 'sh', 'sql'] },
    archive: { labelKey: 'documents.category.archive', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'] },
    audio: { labelKey: 'documents.category.audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
    video: { labelKey: 'documents.category.video', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'] }
};

type SortKey = 'name' | 'size' | 'lastModified';
type SortDirection = 'asc' | 'desc';

// Polling ensures permission changes by admin are reflected without page reload (security)
const DocumentManagerPage = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const { message: antdMessage } = App.useApp();
    const confirm = useConfirm();

    const [effectivePermission, setEffectivePermission] = useState<number>(PermissionLevel.NONE);
    const isAdmin = user?.role === 'admin';

    // Admin role has full access to all document buckets
    const canWrite = isAdmin || effectivePermission >= PermissionLevel.UPLOAD;
    const canDelete = isAdmin || effectivePermission >= PermissionLevel.FULL;

    // Bucket and object state
    const [buckets, setBuckets] = useState<DocumentBucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [objects, setObjects] = useState<FileObject[]>([]);
    const [currentPrefix, setCurrentPrefix] = useState('');

    // Navigation history for back/forward
    const [historyStack, setHistoryStack] = useState<string[]>(['']);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'name',
        direction: 'asc'
    });
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Loading and error state
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, transferProgress: 0 });
    const [error, setError] = useState<string | null>(null);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [folderError, setFolderError] = useState<string | null>(null);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    // State for bucket sync error (bucket configured but not in MinIO)
    const [bucketSyncError, setBucketSyncError] = useState<string | null>(null);

    // Preview state
    const [previewFile, setPreviewFile] = useState<FileObject | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Conflict resolution state
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictFiles, setConflictFiles] = useState<string[]>([]);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<{ files: File[]; preserveFolderStructure: boolean } | null>(null);

    // Table height calculation using ResizeObserver
    const tableWrapperRef = useRef<HTMLDivElement>(null);
    const [tableScrollHeight, setTableScrollHeight] = useState(400);

    useEffect(() => {
        const updateHeight = () => {
            if (tableWrapperRef.current) {
                // Get the wrapper's height minus table header (approx 48px)
                const height = tableWrapperRef.current.clientHeight - 48;
                setTableScrollHeight(Math.max(height, 200));
            }
        };

        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        if (tableWrapperRef.current) {
            observer.observe(tableWrapperRef.current);
        }
        return () => observer.disconnect();
    }, []);



    // Fetch effective permission and poll for changes
    // Polling ensures permission changes by admin are reflected without page reload (security)
    useEffect(() => {
        if (!selectedBucket) {
            setEffectivePermission(PermissionLevel.NONE);
            return;
        }

        const fetchPermission = async () => {
            try {
                const permission = await getEffectivePermission(selectedBucket);
                const previousPermission = effectivePermission;
                setEffectivePermission(permission);

                // If permission changed to NONE (revoked), reload file list and show error
                if (previousPermission !== PermissionLevel.NONE && permission === PermissionLevel.NONE) {
                    antdMessage.error(t('documents.accessDenied'));
                    loadObjects(); // Reload to clear file list or show proper state
                }
            } catch (err) {
                console.error('Failed to fetch storage permissions', err);
                // Handle 403 errors - permission revoked
                if (err instanceof Error && err.message.includes('403')) {
                    setEffectivePermission(PermissionLevel.NONE);
                    // Suppress error message for 403
                    // setError(t('documents.accessDenied'));
                    loadObjects(); // Reload file list on permission error
                }
            }
        };

        // Initial fetch
        fetchPermission();

        // Poll every 30 seconds to detect permission changes
        const pollInterval = setInterval(fetchPermission, 30000);

        return () => clearInterval(pollInterval);
    }, [user?.id, selectedBucket, t]); // Re-fetch when user or bucket changes


    /**
     * Handle bucket selection with localStorage persistence.
     * Resets navigation history when switching buckets.
     * 
     * @param {string} bucketId - The selected bucket ID.
     */
    const handleBucketSelect = (bucketId: string) => {
        setSelectedBucket(bucketId);
        setBucketSyncError(null);  // Clear sync error when switching buckets
        // Save to localStorage
        if (bucketId) {
            localStorage.setItem(STORAGE_KEY_SELECTED_BUCKET, bucketId);
        }
        // Reset navigation when switching buckets
        setCurrentPrefix('');
        setHistoryStack(['']);
        setHistoryIndex(0);
    };

    /**
     * Navigate to a specific folder update history stack.
     * 
     * @param {string} prefix - The folder prefix to navigate to.
     */
    const navigateTo = (prefix: string) => {
        // Add to history stack (remove forward history)
        const newHistory = historyStack.slice(0, historyIndex + 1);
        newHistory.push(prefix);
        setHistoryStack(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentPrefix(prefix);
    };

    /**
     * Go back in navigation history.
     */
    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentPrefix(historyStack[newIndex] || '');
        }
    };

    /**
     * Go forward in navigation history.
     */
    const goForward = () => {
        if (historyIndex < historyStack.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCurrentPrefix(historyStack[newIndex] || '');
        }
    };

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < historyStack.length - 1;

    // Filter and sort objects
    const filteredObjects = useMemo(() => {
        let result = [...objects];

        // 1. Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(obj => obj.name.toLowerCase().includes(query));
        }

        // 2. Category Filter
        if (filterCategory) {
            const category = FILE_CATEGORIES[filterCategory as keyof typeof FILE_CATEGORIES];
            if (category) {
                result = result.filter(obj => {
                    if (obj.isFolder) return false; // Optionally hide folders when filtering by file type? Or keep them? Usually hiding them makes more sense if looking for specific files.
                    // Let's keep folders if we want to navigate, but if we are filtering for "PDFs" we probably just want to see PDFs in current directory.
                    // Documents listObjects is non-recursive (by default/implementation usually), so we only see current level.
                    // If I filter by PDF, I probably don't want to see folders unless I can look inside them.
                    // But if I can't recurse easily here, maybe hiding folders is better.
                    // Let's hide folders when a category filter is active for clarity.
                    const ext = obj.name.split('.').pop()?.toLowerCase() || '';
                    return category.extensions.includes(ext);
                });
            }
        }

        // 3. Sorting
        result.sort((a, b) => {
            // Always keep folders at the top
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;

            let comparison = 0;
            switch (sortConfig.key) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    comparison = a.size - b.size;
                    break;
                case 'lastModified':
                    comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
                    break;
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [objects, searchQuery, filterCategory, sortConfig]);

    // Clear search and filter when changing prefix
    useEffect(() => {
        setSearchQuery('');
        // setFilterCategory(''); // Optional: persist filter across folder navigation?
        // Usually file type filters are useful to keep while browsing.
    }, [currentPrefix]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowFilterMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Recursively read all files from a FileSystemDirectoryEntry.
     * Returns an array of File objects with webkitRelativePath set.
     * 
     * @param {FileSystemDirectoryEntry} dirEntry - The directory entry to read.
     * @param {string} basePath - The relative path accumulator.
     * @returns {Promise<File[]>} List of files with relative paths.
     */
    const readDirectoryRecursively = async (
        dirEntry: FileSystemDirectoryEntry,
        basePath: string = ''
    ): Promise<File[]> => {
        const files: File[] = [];
        const dirReader = dirEntry.createReader();

        const readEntries = (): Promise<FileSystemEntry[]> => {
            return new Promise((resolve, reject) => {
                dirReader.readEntries(resolve, reject);
            });
        };

        // Read all entries (readEntries may return batches)
        let entries: FileSystemEntry[] = [];
        let batch: FileSystemEntry[];
        do {
            batch = await readEntries();
            entries = entries.concat(batch);
        } while (batch.length > 0);

        for (const entry of entries) {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

            if (entry.isFile) {
                const fileEntry = entry as FileSystemFileEntry;
                const file = await new Promise<File>((resolve, reject) => {
                    fileEntry.file((f) => {
                        // Create a new File with the relative path
                        const fileWithPath = new File([f], f.name, {
                            type: f.type,
                            lastModified: f.lastModified,
                        });
                        // Attach the relative path
                        Object.defineProperty(fileWithPath, 'webkitRelativePath', {
                            value: entryPath,
                            writable: false,
                        });
                        resolve(fileWithPath);
                    }, reject);
                });
                files.push(file);
            } else if (entry.isDirectory) {
                const subFiles = await readDirectoryRecursively(
                    entry as FileSystemDirectoryEntry,
                    entryPath
                );
                files.push(...subFiles);
            }
        }

        return files;
    };

    /**
     * Handle drag and drop of files and folders.
     * Preserves folder structure when uploading.
     * Supports multiple folders dropped at once.
     * 
     * @param {React.DragEvent<HTMLDivElement>} e - Drag event.
     */
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        if (!selectedBucket || uploading) return;

        if (!canWrite) {
            setError(t('documents.noUploadPermission'));
            return;
        }

        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;

        // IMPORTANT: Capture all entries synchronously before any async operations
        // The DataTransferItemList is cleared after the drop event handler completes
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item?.kind !== 'file') continue;

            // Use webkitGetAsEntry for folder support
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
                entries.push(entry);
            } else {
                // Fallback: get file directly
                const file = item.getAsFile();
                if (file) {
                    // Create a pseudo FileSystemFileEntry
                    entries.push({
                        isFile: true,
                        isDirectory: false,
                        name: file.name,
                        fullPath: '/' + file.name,
                        filesystem: null as any,
                        file: (callback: (file: File) => void) => callback(file),
                    } as unknown as FileSystemFileEntry);
                }
            }
        }

        if (entries.length === 0) return;

        const allFiles: File[] = [];

        // Now process entries asynchronously
        for (const entry of entries) {
            if (entry.isDirectory) {
                // Recursively read directory contents
                const dirFiles = await readDirectoryRecursively(
                    entry as FileSystemDirectoryEntry,
                    entry.name
                );
                allFiles.push(...dirFiles);
            } else if (entry.isFile) {
                const fileEntry = entry as FileSystemFileEntry;
                const file = await new Promise<File>((resolve, reject) => {
                    fileEntry.file(resolve, reject);
                });
                allFiles.push(file);
            }
        }

        if (allFiles.length > 0) {
            // Check if any files have folder structure
            const hasStructure = allFiles.some(f =>
                (f as any).webkitRelativePath && (f as any).webkitRelativePath.includes('/')
            );

            // Create a FileList-like object
            const fileList = {
                length: allFiles.length,
                item: (index: number) => allFiles[index] || null,
                [Symbol.iterator]: function* () {
                    for (let i = 0; i < allFiles.length; i++) {
                        yield allFiles[i];
                    }
                },
            } as unknown as FileList;

            // Add array access
            allFiles.forEach((file, index) => {
                (fileList as any)[index] = file;
            });

            await handleUpload(fileList, hasStructure);
        }
    };

    /**
     * Handle updating the drag counter when entering drop zone.
     * @param {React.DragEvent<HTMLDivElement>} e - Drag event.
     */
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    /**
     * Handle updating the drag counter when leaving drop zone.
     * @param {React.DragEvent<HTMLDivElement>} e - Drag event.
     */
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    /**
     * Prevent default behavior when dragging over.
     * @param {React.DragEvent<HTMLDivElement>} e - Drag event.
     */
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Wrapper handled in general click outside
    /*
    // Close upload menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setShowUploadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    */

    useEffect(() => {
        loadBuckets();
    }, []);

    useEffect(() => {
        if (selectedBucket) {
            loadObjects();
        } else {
            setObjects([]);
        }
    }, [selectedBucket, currentPrefix]);

    /**
     * Load the list of configured buckets from the database.
     * Tries to restore the last selected bucket from localStorage.
     */
    const loadBuckets = async () => {
        try {
            const data = await getBuckets();
            setBuckets(data);

            if (data.length > 0 && !selectedBucket) {
                // Try to restore from localStorage
                const savedBucketId = localStorage.getItem(STORAGE_KEY_SELECTED_BUCKET);

                // Check if saved bucket still exists in the list
                const savedBucketExists = savedBucketId && data.some(b => b.id === savedBucketId);

                if (savedBucketExists) {
                    // Restore saved bucket
                    setSelectedBucket(savedBucketId);
                } else {
                    // Fall back to first bucket
                    const firstBucketId = data[0]?.id || '';
                    setSelectedBucket(firstBucketId);
                    if (firstBucketId) {
                        localStorage.setItem(STORAGE_KEY_SELECTED_BUCKET, firstBucketId);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('documents.loadFailed'));
        }
    };

    /**
     * Fetch files and folders for the current bucket and prefix.
     * Handles sync errors if the bucket doesn't exist in MinIO.
     */
    const loadObjects = async () => {
        if (!selectedBucket) return;

        setLoading(true);
        setError(null);
        setBucketSyncError(null);
        try {
            const data = await listObjects(selectedBucket, currentPrefix);
            setObjects(data);
            setSelectedItems(new Set());
        } catch (err) {
            // Check if this is a bucket sync error (bucket configured but not in MinIO)
            if (err instanceof DocumentServiceError && err.code === 'BUCKET_NOT_IN_STORAGE') {
                setBucketSyncError(err.message);
                setObjects([]);
            } else if (err instanceof Error && (err.message.includes('403') || (err as any).status === 403)) {
                // Suppress 403 errors and clear objects
                setObjects([]);
            } else {
                setError(err instanceof Error ? err.message : t('documents.loadFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * Process the upload of files to MinIO.
     * 
     * @param {File[]} files - Files to upload.
     * @param {boolean} preserveFolderStructure - Whether to use webkitRelativePath.
     */
    const processUpload = async (files: File[], preserveFolderStructure: boolean = false) => {
        if (!selectedBucket || files.length === 0) return;

        setUploading(true);
        setUploadProgress({ current: 0, total: files.length, transferProgress: 0 });
        try {
            const onProgress = (progress: number) => {
                setUploadProgress((prev: any) => ({ ...prev, transferProgress: progress }));
            };

            const result = await uploadFiles(selectedBucket, files, currentPrefix, onProgress, preserveFolderStructure);

            // Update progress to show completion
            setUploadProgress((prev: any) => ({ ...prev, current: files.length, transferProgress: 100 }));

            // Check for rejected or failed files
            const rejectedFiles = result.results?.filter((r: any) => r.status === 'rejected' || r.status === 'failed') || [];

            if (rejectedFiles.length > 0) {
                const errorMessages = rejectedFiles.map((r: any) =>
                    `• ${r.originalName}: ${r.error || 'Upload failed'}`
                ).join('\n');

                const successCount = result.results?.filter((r: any) => r.status === 'uploaded').length || 0;
                const totalCount = files.length;

                setError(`${successCount}/${totalCount} files uploaded successfully.\n\n${rejectedFiles.length} file(s) failed:\n${errorMessages}`);
            }

            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('documents.uploadFailed'));
        } finally {
            setUploading(false);
            setPendingUploadFiles(null);
            setShowConflictModal(false);
            setConflictFiles([]);
        }
    };

    /**
     * Handle file selection from input or drop.
     * Checks for file existence conflicts before uploading.
     * 
     * @param {FileList} fileList - List of files to upload.
     * @param {boolean} preserveFolderStructure - Whether to maintain folder structure.
     */
    const handleUpload = async (fileList: FileList, preserveFolderStructure: boolean = false) => {
        if (!selectedBucket || fileList.length === 0) return;

        if (!canWrite) {
            setError(t('documents.noUploadPermission'));
            return;
        }

        const files = Array.from(fileList);

        // Calculate target paths to check for existence
        // Logic mostly mirrors the backend path resolution but we need to check exact matches
        // For simplicity, we check existence using the paths we intend to create
        const pathsToCheck: string[] = [];

        // We need to replicate backend logic for object path generation to check correctly
        // Backend: targetPrefix + (preserve ? relativePath : filename)

        const targetPrefix = currentPrefix; // Already includes trailing slash if not empty

        files.forEach(file => {
            let objectPath = '';
            if (preserveFolderStructure && (file as any).webkitRelativePath) {
                // Browser Relative Path usually includes the root folder of selection
                // e.g. "MyFolder/sub/file.txt"
                // If we are in "root/", passing "MyFolder/sub/file.txt" means object path is "root/MyFolder/sub/file.txt"
                // Backend handles this.
                // We should send the path relative to current prefix.
                objectPath = targetPrefix + (file as any).webkitRelativePath;
            } else {
                objectPath = targetPrefix + file.name;
            }
            pathsToCheck.push(objectPath);
        });

        try {
            // Check existence
            const { exists } = await checkFilesExistence(selectedBucket, pathsToCheck);

            if (exists && exists.length > 0) {
                setConflictFiles(exists);
                setPendingUploadFiles({ files, preserveFolderStructure });
                setShowConflictModal(true);
            } else {
                // No conflicts, proceed directly
                await processUpload(files, preserveFolderStructure);
            }
        } catch (err) {
            console.error("Failed to check existence, proceeding with upload anyway:", err);
            // Fallback to direct upload if check fails (optimize for UX vs strictness)
            await processUpload(files, preserveFolderStructure);
        }
    };

    /**
     * Resolve file name conflicts during upload.
     * 
     * @param {'replace' | 'skip' | 'keepBoth'} action - Resolution strategy.
     */
    const handleConflictResolution = async (action: 'replace' | 'skip' | 'keepBoth') => {
        if (!pendingUploadFiles) return;

        const { files, preserveFolderStructure } = pendingUploadFiles;

        if (action === 'replace') {
            await processUpload(files, preserveFolderStructure);
        } else if (action === 'skip') {
            const filesToUpload = files.filter((file: File) => {
                const objectPath = preserveFolderStructure && (file as any).webkitRelativePath
                    ? currentPrefix + (file as any).webkitRelativePath
                    : currentPrefix + file.name;
                return !conflictFiles.includes(objectPath);
            });
            if (filesToUpload.length > 0) {
                await processUpload(filesToUpload, preserveFolderStructure);
            } else {
                setPendingUploadFiles(null);
                setShowConflictModal(false);
            }
        } else if (action === 'keepBoth') {
            // Rename duplicates
            // Since File.name is read-only, we create new File objects
            const filesToUpload = files.map((file: File) => {
                const objectPath = preserveFolderStructure && (file as any).webkitRelativePath
                    ? currentPrefix + (file as any).webkitRelativePath
                    : currentPrefix + file.name;

                if (conflictFiles.includes(objectPath)) {
                    // Generate new name: filename (1).ext
                    // Logic needs to handle if path has folders
                    const nameParts = file.name.split('.');
                    const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
                    const base = nameParts.join('.');
                    const newName = `${base} (1)${ext}`;

                    // If preserving structure, we need to update webkitRelativePath?
                    // webkitRelativePath is also read-only.
                    // IMPORTANT: Backend relies on webkitRelativePath for structure.
                    // If we rename the file, the backend might still use the old relative path if check is based on form field.
                    // My backend implementation checks filePaths array from body.

                    // If I create a new file, I can try to hack webkitRelativePath property.
                    const newFile = new File([file], newName, { type: file.type, lastModified: file.lastModified });

                    if (preserveFolderStructure && (file as any).webkitRelativePath) {
                        const oldPath = (file as any).webkitRelativePath;
                        const pathParts = oldPath.split('/');
                        pathParts[pathParts.length - 1] = newName;
                        const newPath = pathParts.join('/');

                        Object.defineProperty(newFile, 'webkitRelativePath', {
                            value: newPath,
                            writable: false,
                        });
                    }
                    return newFile;
                }
                return file;
            });
            await processUpload(filesToUpload, preserveFolderStructure);
        }
    };

    /**
     * Delete a single file or folder.
     * 
     * @param {FileObject} obj - The object to delete.
     */
    const handleDelete = async (obj: FileObject) => {
        const confirmed = await confirm({
            message: t('documents.deleteConfirm', { type: obj.isFolder ? t('documents.folder') : t('documents.file'), name: obj.name }),
            variant: 'danger'
        });
        if (!confirmed) return;

        setDeleting(true);
        setDeleteProgress({ current: 0, total: 1 });
        try {
            const fullPath = currentPrefix + obj.name;
            await deleteObject(selectedBucket, fullPath, obj.isFolder);
            setDeleteProgress({ current: 1, total: 1 });
            await loadObjects();
        } catch (err) {
            const message = err instanceof Error ? err.message : t('documents.deleteFailed');
            if (message === 'REAUTH_REQUIRED') {
                setError(t('documents.reauthRequired'));
            } else {
                setError(message);
            }
        } finally {
            setDeleting(false);
        }
    };

    /**
     * Delete multiple selected items.
     */
    const handleBatchDelete = async () => {
        if (selectedItems.size === 0) return;
        const confirmed = await confirm({
            message: t('documents.batchDeleteConfirm', { count: selectedItems.size }),
            variant: 'danger'
        });
        if (!confirmed) return;

        setDeleting(true);
        const objectsToDelete = objects
            .filter((obj: FileObject) => selectedItems.has(obj.name))
            .map((obj: FileObject) => ({
                name: currentPrefix + obj.name,
                isFolder: obj.isFolder,
            }));

        setDeleteProgress({ current: 0, total: objectsToDelete.length });

        try {
            // Use batch delete API for atomic operation and better performance
            await batchDelete(selectedBucket, objectsToDelete);
            setDeleteProgress({ current: objectsToDelete.length, total: objectsToDelete.length });

            setSelectedItems(new Set());
            await loadObjects();
        } catch (err) {
            const message = err instanceof Error ? err.message : t('documents.deleteFailed');
            if (message === 'REAUTH_REQUIRED') {
                setError(t('documents.reauthRequired'));
            } else {
                setError(message);
            }
        } finally {
            setDeleting(false);
        }
    };

    /**
     * Download a file.
     * 
     * @param {FileObject} obj - The file to download.
     */
    const handleDownload = async (obj: FileObject) => {
        try {
            const fullPath = currentPrefix + obj.name;
            const url = await getDownloadUrl(selectedBucket, fullPath);
            window.open(url, '_blank');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('documents.loadFailed'));
        }
    };

    /**
     * Helper to get file icon based on extension.
     * @param {string} filename - Name of the file.
     * @returns {JSX.Element} Icon component.
     */
    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        switch (ext) {
            case 'pdf':
                return <FileText className="w-5 h-5 text-red-500" />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'svg':
                return <FileImage className="w-5 h-5 text-purple-500" />;
            case 'xls':
            case 'xlsx':
            case 'csv':
                return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
            case 'doc':
            case 'docx':
                return <FileText className="w-5 h-5 text-blue-500" />;
            case 'ppt':
            case 'pptx':
                return <FileText className="w-5 h-5 text-orange-500" />;
            case 'json':
            case 'xml':
            case 'yml':
            case 'yaml':
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'css':
                return <FileCode className="w-5 h-5 text-gray-500" />;
            default:
                return <FileIcon className="w-5 h-5 text-gray-400" />;
        }
    };

    /**
     * Helper to check if preview is supported.
     * @param {string} filename - Name of the file.
     * @returns {boolean} True if supported.
     */
    const isPreviewSupported = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const supported = [
            'pdf',
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
            'txt', 'md', 'json', 'xml', 'log', 'css', 'js', 'ts', 'tsx', 'jsx', 'yml', 'yaml',
            'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
        ];
        return supported.includes(ext);
    };

    /**
     * Open preview modal for a file.
     * 
     * @param {FileObject} obj - File to preview.
     */
    const handlePreview = async (obj: FileObject) => {
        // Check permission before allowing preview
        if (effectivePermission < PermissionLevel.VIEW) {
            setError(t('documents.accessDenied'));
            return;
        }

        if (!isPreviewSupported(obj.name)) return;

        try {
            const fullPath = currentPrefix + obj.name;
            // Use backend preview endpoint with caching
            // URL format: /api/preview/:bucketId/:filePath
            // Encode path components but preserve slashes
            const encodedPath = fullPath.split('/').map(part => encodeURIComponent(part)).join('/');
            const url = `${API_BASE_URL}/api/preview/${selectedBucket}/${encodedPath}`;

            setPreviewFile(obj);
            setPreviewUrl(url);
            setShowPreview(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('documents.loadFailed'));
        }
    };



    /**
     * Navigate into a folder.
     * 
     * @param {FileObject} obj - Folder object.
     */
    const navigateToFolder = (obj: FileObject) => {
        if (obj.isFolder) {
            navigateTo(obj.prefix || currentPrefix + obj.name + '/');
        }
    };

    /**
     * Create a new folder in the current directory.
     */
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            setFolderError(t('documents.folderNameRequired'));
            return;
        }

        setFolderError(null);
        setCreatingFolder(true);
        try {
            await createFolder(selectedBucket, newFolderName.trim(), currentPrefix);
            setShowCreateFolderModal(false);
            setNewFolderName('');
            setFolderError(null);
            await loadObjects();
        } catch (err) {
            setFolderError(err instanceof Error ? err.message : t('documents.createFolderFailed'));
        } finally {
            setCreatingFolder(false);
        }
    };



    const bucketOptions = buckets.map((b: DocumentBucket) => ({
        id: b.id,
        name: b.display_name || b.bucket_name
    }));

    // Get selected bucket info for description display
    const selectedBucketInfo = buckets.find((b: DocumentBucket) => b.id === selectedBucket);

    /**
     * Define columns for Ant Design Table
     */
    const columns = useMemo(() => [
        {
            title: t('documents.name'),
            dataIndex: 'name',
            key: 'name',
            sorter: true,
            width: 'auto',
            minWidth: 200,
            render: (_text: string, record: FileObject) => (
                <button
                    onClick={() => record.isFolder && navigateToFolder(record)}
                    className={`flex items-center gap-2 text-left truncate max-w-full ${record.isFolder ? 'text-primary dark:text-blue-400 hover:text-primary-hover dark:hover:text-blue-300 font-medium' : 'text-gray-900 dark:text-white'}`}
                >
                    {record.isFolder ? <span className="text-xl flex-shrink-0">📁</span> : getFileIcon(record.name)}
                    <span className="truncate">{record.name}</span>
                </button>
            )
        },
        {
            title: t('documents.size'),
            dataIndex: 'size',
            key: 'size',
            width: 120,
            align: 'right' as const,
            sorter: true,
            sortOrder: sortConfig.key === 'size' ? (sortConfig.direction === 'asc' ? 'ascend' : 'descend') as any : null,
            render: (size: number, record: FileObject) => record.isFolder ? '-' : formatFileSize(size)
        },
        {
            title: t('documents.modified'),
            dataIndex: 'lastModified',
            key: 'lastModified',
            width: 200,
            sorter: true,
            sortOrder: sortConfig.key === 'lastModified' ? (sortConfig.direction === 'asc' ? 'ascend' : 'descend') as any : null,
            render: (date: string) => date ? new Date(date).toLocaleString() : '-'
        },
        {
            title: t('documents.actions'),
            key: 'actions',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: FileObject) => (
                <Space size="small">
                    {!record.isFolder && (
                        <>
                            <Tooltip title={t('documents.preview')}>
                                <Button
                                    type="text"
                                    icon={<Eye size={16} />}
                                    onClick={() => handlePreview(record)}
                                />
                            </Tooltip>
                            <Tooltip title={t('documents.download')}>
                                <Button
                                    type="text"
                                    icon={<Download size={16} />}
                                    onClick={() => handleDownload(record)}
                                />
                            </Tooltip>
                        </>
                    )}
                    {canDelete && (
                        <Tooltip title={t('documents.delete')}>
                            <Button
                                type="text"
                                danger
                                icon={<Trash2 size={16} />}
                                onClick={() => handleDelete(record)}
                            />
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ], [t, sortConfig, canWrite, handlePreview, handleDownload, handleDelete, navigateToFolder]);

    /**
     * Handle table change (sorting)
     */
    const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
        if (sorter.field && sorter.order) {
            setSortConfig({
                key: sorter.field as SortKey,
                direction: sorter.order === 'ascend' ? 'asc' : 'desc'
            });
        } else {
            // Default sort
            setSortConfig({
                key: 'name',
                direction: 'asc'
            });
        }
    };

    const rowSelection = {
        selectedRowKeys: Array.from(selectedItems) as React.Key[],
        onChange: (selectedRowKeys: React.Key[]) => {
            setSelectedItems(new Set(selectedRowKeys as string[]));
        },
        columnWidth: 50,
    };

    const headerActions = document.getElementById('header-actions');

    return (
        <div className="w-full h-full flex flex-col">
            {headerActions && createPortal(
                <div className="flex items-center gap-2">
                    {error && (
                        <div className="mr-2 flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-200 dark:border-red-800 max-w-2xl">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="whitespace-pre-line">{error}</span>
                        </div>
                    )}
                    <Select
                        value={selectedBucket}
                        onChange={handleBucketSelect}
                        options={bucketOptions}
                        disabled={buckets.length === 0}
                        className="w-64"
                    />
                </div>,
                headerActions
            )}

            {/* Breadcrumb Navigation */}
            {selectedBucket && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-4">
                    {/* Left: Breadcrumb */}
                    <div className="flex items-center gap-1 text-sm overflow-x-auto flex-shrink-0">
                        <button
                            onClick={() => navigateTo('')}
                            className="flex items-center gap-1 px-2 py-1 text-primary dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title={t('documents.rootFolder')}
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('documents.root')}</span>
                        </button>
                        {currentPrefix && currentPrefix.split('/').filter(Boolean).map((folder: string, index: number, arr: string[]) => {
                            const path = arr.slice(0, index + 1).join('/') + '/';
                            const isLast = index === arr.length - 1;
                            return (
                                <div key={path} className="flex items-center gap-1">
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                    <button
                                        onClick={() => !isLast && navigateTo(path)}
                                        className={`px-2 py-1 rounded transition-colors ${isLast
                                            ? 'text-gray-900 dark:text-white font-medium bg-gray-100 dark:bg-gray-700'
                                            : 'text-primary dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30'
                                            }`}
                                    >
                                        {folder}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Right: Bucket description */}
                    {selectedBucketInfo?.description && (
                        <div className="flex-shrink-0 text-sm text-gray-500 dark:text-gray-400 italic truncate max-w-md" title={selectedBucketInfo.description}>
                            {selectedBucketInfo.description}
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                    {/* Back/Forward navigation */}
                    <div className="flex items-center gap-1 mr-2">
                        <button
                            onClick={goBack}
                            disabled={!canGoBack}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('documents.back')}
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                            onClick={goForward}
                            disabled={!canGoForward}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('documents.forward')}
                        >
                            <ArrowRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>

                    {selectedItems.size > 0 && (
                        <button
                            onClick={handleBatchDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="hidden sm:inline">{t('common.delete')} ({selectedItems.size})</span>
                        </button>
                    )}
                </div>

                {/* Search input */}
                <div className="flex-1 max-w-md mx-4">
                    <Input
                        prefix={<Search size={16} className="text-gray-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('documents.searchPlaceholder')}
                        disabled={!selectedBucket}
                        allowClear
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Filter Dropdown */}
                    <div className="relative" ref={filterMenuRef}>
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            disabled={!selectedBucket}
                            className={`p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${filterCategory ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                                }`}
                            title={t('documents.filter')}
                        >
                            <Filter className="w-5 h-5" />
                        </button>
                        {showFilterMenu && (
                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                                <button
                                    onClick={() => {
                                        setFilterCategory('');
                                        setShowFilterMenu(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${!filterCategory ? 'text-primary dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/10' : 'text-gray-700 dark:text-gray-200'
                                        }`}
                                >
                                    <span>{t('documents.allFiles')}</span>
                                    {!filterCategory && <ChevronDown className="w-4 h-4 rotate-[-90deg]" />}
                                </button>
                                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                {Object.entries(FILE_CATEGORIES).map(([key, category]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setFilterCategory(key);
                                            setShowFilterMenu(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${filterCategory === key ? 'text-primary dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/10' : 'text-gray-700 dark:text-gray-200'
                                            }`}
                                    >
                                        <span>{t(category.labelKey)}</span>
                                        {filterCategory === key && <ChevronDown className="w-4 h-4 rotate-[-90deg]" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <Button
                            icon={<RefreshCw size={16} />}
                            onClick={() => loadObjects()}
                            disabled={!selectedBucket}
                        />

                        {canWrite && (
                            <Button
                                icon={<FolderPlus size={16} />}
                                onClick={() => setShowCreateFolderModal(true)}
                                disabled={!selectedBucket}
                            />
                        )}

                        {/* Upload dropdown */}
                        {canWrite && (
                            <Dropdown
                                disabled={!selectedBucket}
                                menu={{
                                    items: [
                                        {
                                            key: 'files',
                                            label: t('documents.uploadFiles'),
                                            icon: <Upload size={16} />,
                                            onClick: () => fileInputRef.current?.click()
                                        },
                                        {
                                            key: 'folder',
                                            label: t('documents.uploadFolder'),
                                            icon: <FolderPlus size={16} />,
                                            onClick: () => folderInputRef.current?.click()
                                        }
                                    ]
                                }}
                            >
                                <Button
                                    type="primary"
                                    icon={<Upload size={16} />}
                                >
                                    <span className="hidden sm:inline">{t('documents.upload')}</span>
                                    <ChevronDown size={14} className="ml-1" />
                                </Button>
                            </Dropdown>
                        )}
                    </div>
                </div>
            </div>

            {/* Table with Virtual Scrolling */}
            <div
                ref={tableWrapperRef}
                className={`flex-1 flex flex-col min-h-0 relative ${isDragging && selectedBucket ? 'ring-2 ring-primary dark:ring-blue-500 ring-inset' : ''
                    }`}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
            >
                {/* Drag overlay */}
                {isDragging && selectedBucket && (
                    <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/20 z-10 flex items-center justify-center pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 border-dashed border-primary dark:border-blue-500 flex flex-col items-center gap-3">
                            <Upload className="w-12 h-12 text-primary dark:text-blue-400" />
                            <span className="text-lg font-medium text-gray-900 dark:text-white">
                                {t('documents.dropFilesHere')}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {t('documents.dropFilesHint')}
                            </span>
                        </div>
                    </div>
                )}

                {/* No buckets message for leaders OR Table */}
                {!isAdmin && buckets.length === 0 && !loading ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                {t('documents.noPermissionTitle')}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {t('documents.noPermissionMessage')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800 shadow rounded-lg min-h-0 flex flex-col document-table-container">
                            <Table
                                rowKey="name"
                                columns={columns}
                                dataSource={filteredObjects}
                                rowSelection={rowSelection}
                                loading={loading}
                                onChange={handleTableChange}
                                pagination={false}
                                size="middle"
                                scroll={{ y: tableScrollHeight }}
                                virtual
                                locale={{
                                    emptyText: !selectedBucket ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <HardDrive className="w-12 h-12 text-gray-300 mb-2" />
                                            <span className="text-lg font-medium">{t('documents.noBucketSelected')}</span>
                                            <span className="text-sm">{t('documents.selectBucketPrompt')}</span>
                                        </div>
                                    ) : bucketSyncError ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <AlertCircle className="w-12 h-12 text-amber-500 mb-2" />
                                            <span className="text-lg font-medium text-amber-600">{t('documents.bucketSyncError')}</span>
                                            <span className="text-sm text-center max-w-md mt-2">{bucketSyncError}</span>
                                            <span className="text-sm mt-2">{t('documents.contactAdmin')}</span>
                                        </div>
                                    ) : objects.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <FolderPlus className="w-12 h-12 text-gray-300 mb-2" />
                                            <span className="text-lg font-medium">{t('documents.emptyBucket')}</span>
                                            <span className="text-sm">{t('documents.uploadPrompt')}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <Search className="w-12 h-12 text-gray-300 mb-2" />
                                            <span className="text-lg font-medium">{t('documents.noSearchResults')}</span>
                                            <span className="text-sm">{t('documents.noSearchResultsHint')}</span>
                                        </div>
                                    )
                                }}
                            />
                        </div>
                    </>
                )}
            </div>


            {/* Conflict Resolution Modal */}
            {showConflictModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-8 h-8 text-yellow-500" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {t('documents.conflictDetected', 'File Conflict Detected')}
                            </h3>
                        </div>

                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            {t('documents.conflictMessage', {
                                count: conflictFiles.length,
                                defaultValue: `${conflictFiles.length} file(s) already exist in this location.`
                            })}
                        </p>

                        <div className="space-y-2 mb-6 max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded">
                            {conflictFiles.slice(0, 10).map((file, i) => (
                                <div key={i} className="text-sm text-gray-500 truncate">
                                    {file}
                                </div>
                            ))}
                            {conflictFiles.length > 10 && (
                                <div className="text-xs text-center text-gray-400 mt-1">
                                    {t('documents.andMore', { count: conflictFiles.length - 10, defaultValue: `...and ${conflictFiles.length - 10} more` })}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleConflictResolution('replace')}
                                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {t('documents.replace', 'Replace All')}
                            </button>
                            <button
                                onClick={() => handleConflictResolution('keepBoth')}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {t('documents.keepBoth', 'Keep Both (Rename)')}
                            </button>
                            <button
                                onClick={() => handleConflictResolution('skip')}
                                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {t('documents.skip', 'Skip Duplicates')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowConflictModal(false);
                                    setPendingUploadFiles(null);
                                    setConflictFiles([]);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Progress Modal */}
            {uploading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Upload className="w-6 h-6 text-primary animate-pulse" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('documents.uploadingFiles')}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                <span>{t('documents.filesProgress')}</span>
                                <span>{uploadProgress.total} {t('documents.filesCount')}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                <span>{t('documents.transferProgress')}</span>
                                <span>{uploadProgress.transferProgress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-primary dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress.transferProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {showCreateFolderModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('documents.createFolder')}</h2>
                            <button
                                onClick={() => {
                                    setShowCreateFolderModal(false);
                                    setNewFolderName('');
                                    setFolderError(null);
                                }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('documents.folderName')}
                                </label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => {
                                        setNewFolderName(e.target.value);
                                        setFolderError(null);
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                                    placeholder={t('documents.folderNamePlaceholder')}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-blue-500 focus:border-transparent ${folderError
                                        ? 'border-red-500 dark:border-red-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                    autoFocus
                                />
                                {folderError && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{folderError}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => {
                                    setShowCreateFolderModal(false);
                                    setNewFolderName('');
                                    setFolderError(null);
                                }}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={creatingFolder || !newFolderName.trim()}
                                className="px-4 py-2 bg-primary dark:bg-blue-600 hover:bg-primary-hover dark:hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {creatingFolder ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        {t('documents.creatingFolder')}
                                    </>
                                ) : (
                                    t('documents.createFolder')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Progress Modal */}
            {deleting && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('documents.deletingItems')}
                            </h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                <span>{t('documents.progress')}</span>
                                <span>{deleteProgress.current} / {deleteProgress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-primary dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Modal */}
            {/* Preview Modal */}
            {showPreview && previewFile && (
                <FilePreviewModal
                    onClose={() => {
                        setShowPreview(false);
                        setPreviewFile(null);
                        setPreviewUrl(null);
                    }}
                    file={previewFile}
                    url={previewUrl || ''}
                    onDownload={() => handleDownload(previewFile)}
                />
            )}
        </div>
    );
};

export default DocumentManagerPage;
