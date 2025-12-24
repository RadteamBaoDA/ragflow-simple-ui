/**
 * @fileoverview User preferences service using IndexedDB.
 * 
 * Provides persistent storage for user-specific settings:
 * - Uses IndexedDB for large data storage
 * - Scoped by userId to support multiple users on same device
 * - Async operations with error handling
 * 
 * Use cases:
 * - Storing selected RAGFlow sources
 * - Theme preferences
 * - UI state persistence
 * 
 * @module services/userPreferences
 */

// ============================================================================
// Constants
// ============================================================================

/** IndexedDB database name */
const DB_NAME = 'kb-preferences';
/** Database schema version */
const DB_VERSION = 1;
/** Object store name for user settings */
const STORE_NAME = 'user_settings';

// ============================================================================
// Types
// ============================================================================

/**
 * Stored user setting record.
 */
interface UserSetting {
    /** User ID (for scoping) */
    userId: string;
    /** Setting key */
    key: string;
    /** Setting value (any serializable type) */
    value: any;
    /** Last update timestamp */
    updatedAt: number;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for persisting user preferences to IndexedDB.
 * Settings are scoped by userId to support multiple users.
 */
class UserPreferencesService {
    /** Cached database connection promise */
    private dbPromise: Promise<IDBDatabase> | null = null;

    /**
     * Get or create IndexedDB connection.
     * Creates the database and object store on first access.
     * @returns Promise resolving to database connection
     */
    private async getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            // Handle database upgrade (create schema)
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Create object store with composite key [userId, key]
                    db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'key'] });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });

        return this.dbPromise;
    }

    /**
     * Get a setting for a specific user.
     * @template T - Expected value type
     * @param userId - User ID for scoping
     * @param key - Setting key
     * @param defaultValue - Value to return if not found
     * @returns Promise resolving to setting value or default
     */
    async get<T>(userId: string, key: string, defaultValue?: T): Promise<T | undefined> {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get([userId, key]);

                request.onsuccess = () => {
                    const result = request.result as UserSetting | undefined;
                    resolve(result ? result.value : defaultValue);
                };

                request.onerror = () => {
                    console.error(`Failed to get setting ${key} for user ${userId}`);
                    resolve(defaultValue);
                };
            });
        } catch (error) {
            console.error('Error accessing IndexedDB:', error);
            return defaultValue;
        }
    }

    /**
     * Save a setting for a specific user.
     * @param userId - User ID for scoping
     * @param key - Setting key
     * @param value - Value to store
     */
    async set(userId: string, key: string, value: any): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const setting: UserSetting = {
                    userId,
                    key,
                    value,
                    updatedAt: Date.now(),
                };

                const request = store.put(setting);

                request.onsuccess = () => resolve();
                request.onerror = (event) => {
                    console.error(`Failed to save setting ${key} for user ${userId}`, (event.target as IDBOpenDBRequest).error);
                    resolve(); // Resolve anyway to prevent hanging
                };
            });
        } catch (error) {
            console.error('Error accessing IndexedDB:', error);
        }
    }
}

/** Singleton instance of user preferences service */
export const userPreferences = new UserPreferencesService();
