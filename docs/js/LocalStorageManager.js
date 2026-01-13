/**
 * LocalStorageManager - IndexedDB wrapper for local-first file storage
 * Provides CRUD operations, dirty tracking, and sync metadata management
 */
class LocalStorageManager {
    static DB_NAME = 'M2B-LocalStorage';
    static DB_VERSION = 1;
    static STORE_NAME = 'files';
    static db = null;

    /**
     * Initialize IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    static async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'path' });

                    // Create indexes for efficient queries
                    store.createIndex('isDirty', 'isDirty', { unique: false });
                    store.createIndex('lastModified', 'lastModified', { unique: false });
                    store.createIndex('syncStatus', 'syncStatus', { unique: false });
                }
            };
        });
    }

    /**
     * Get a transaction
     * @param {string} mode - 'readonly' or 'readwrite'
     * @returns {Promise<IDBObjectStore>}
     */
    static async getStore(mode = 'readonly') {
        const db = await this.init();
        const transaction = db.transaction([this.STORE_NAME], mode);
        return transaction.objectStore(this.STORE_NAME);
    }

    /**
     * Get a file by path
     * @param {string} path - File path (e.g., "md/ToDo/Work.md")
     * @returns {Promise<Object|null>}
     */
    static async getFile(path) {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(path);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save a file to local storage
     * @param {string} path - File path
     * @param {string} content - File content
     * @param {boolean} markDirty - Whether to mark as dirty (default: true)
     * @param {string} githubSHA - Optional GitHub SHA
     * @returns {Promise<void>}
     */
    static async saveFile(path, content, markDirty = true, githubSHA = null) {
        const now = Date.now();

        // Get existing file record to preserve metadata (before opening transaction)
        const existing = await this.getFile(path);

        const fileRecord = {
            path,
            content,
            lastModified: now,
            isDirty: markDirty,
            githubSHA: githubSHA || (existing ? existing.githubSHA : null),
            lastSynced: existing ? existing.lastSynced : null,
            syncStatus: markDirty ? 'dirty' : (existing ? existing.syncStatus : 'synced')
        };

        // Open transaction AFTER getting existing file
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(fileRecord);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all files, optionally filtered by directory
     * @param {string|null} directory - Optional directory filter (e.g., "md/ToDo")
     * @returns {Promise<Array>}
     */
    static async getAllFiles(directory = null) {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                let files = request.result;
                if (directory) {
                    files = files.filter(f => f.path.startsWith(directory + '/'));
                }
                resolve(files);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a file
     * @param {string} path - File path
     * @returns {Promise<void>}
     */
    static async deleteFile(path) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(path);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all dirty files
     * @returns {Promise<Array>}
     */
    static async getDirtyFiles() {
        try {
            const allFiles = await this.getAllFiles();
            return allFiles.filter(f => f.isDirty === true);
        } catch (error) {
            console.error('Error getting dirty files:', error);
            return [];
        }
    }

    /**
     * Mark a file as clean (synced)
     * @param {string} path - File path
     * @param {string} githubSHA - GitHub SHA after successful push
     * @returns {Promise<void>}
     */
    static async markClean(path, githubSHA) {
        const file = await this.getFile(path);
        if (!file) return;

        file.isDirty = false;
        file.githubSHA = githubSHA;
        file.lastSynced = Date.now();
        file.syncStatus = 'synced';

        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(file);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Mark a file as having a conflict
     * @param {string} path - File path
     * @returns {Promise<void>}
     */
    static async markConflict(path) {
        const file = await this.getFile(path);
        if (!file) return;

        file.syncStatus = 'conflict';

        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(file);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update GitHub SHA for a file
     * @param {string} path - File path
     * @param {string} sha - GitHub SHA
     * @returns {Promise<void>}
     */
    static async updateSHA(path, sha) {
        const file = await this.getFile(path);
        if (!file) return;

        file.githubSHA = sha;

        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(file);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get file metadata without full content
     * @param {string} path - File path
     * @returns {Promise<Object|null>}
     */
    static async getFileMetadata(path) {
        const file = await this.getFile(path);
        if (!file) return null;

        return {
            path: file.path,
            lastModified: file.lastModified,
            isDirty: file.isDirty,
            githubSHA: file.githubSHA,
            lastSynced: file.lastSynced,
            syncStatus: file.syncStatus
        };
    }

    /**
     * Bulk save multiple files
     * @param {Array} filesArray - Array of {path, content, markDirty, githubSHA} objects
     * @returns {Promise<void>}
     */
    static async bulkSave(filesArray) {
        const now = Date.now();

        // Process each file sequentially to avoid transaction timing issues
        for (const { path, content, markDirty = true, githubSHA = null } of filesArray) {
            const existing = await this.getFile(path);
            const fileRecord = {
                path,
                content,
                lastModified: now,
                isDirty: markDirty,
                githubSHA: githubSHA || (existing ? existing.githubSHA : null),
                lastSynced: existing ? existing.lastSynced : null,
                syncStatus: markDirty ? 'dirty' : (existing ? existing.syncStatus : 'synced')
            };

            // Each save gets its own transaction
            const store = await this.getStore('readwrite');
            await new Promise((resolve, reject) => {
                const request = store.put(fileRecord);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Clear all local storage (for debugging/reset)
     * @returns {Promise<void>}
     */
    static async clearAll() {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if local storage has any data
     * @returns {Promise<boolean>}
     */
    static async hasData() {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result > 0);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get count of files by status
     * @returns {Promise<Object>} - {total, dirty, synced, conflicts}
     */
    static async getStatusCounts() {
        const allFiles = await this.getAllFiles();
        return {
            total: allFiles.length,
            dirty: allFiles.filter(f => f.isDirty && f.syncStatus !== 'conflict').length,
            synced: allFiles.filter(f => !f.isDirty && f.syncStatus === 'synced').length,
            conflicts: allFiles.filter(f => f.syncStatus === 'conflict').length
        };
    }

    /**
     * Get all files with conflicts
     * @returns {Promise<Array>}
     */
    static async getConflictFiles() {
        const store = await this.getStore('readonly');
        const index = store.index('syncStatus');
        return new Promise((resolve, reject) => {
            const request = index.getAll('conflict');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

}

// Expose globally
window.LocalStorageManager = LocalStorageManager;
