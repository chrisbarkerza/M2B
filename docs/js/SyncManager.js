/**
 * SyncManager - Orchestrates sync between local IndexedDB and GitHub
 * Handles conflict detection, resolution, and status reporting
 */
class SyncManager {
    static syncInProgress = false;
    static lastSyncTime = null;
    static syncListeners = [];

    /**
     * Main sync entry point - syncs all dirty files to GitHub
     * @returns {Promise<Object>} - { synced, conflicts, errors }
     */
    static async syncAll() {
        if (this.syncInProgress) {
            console.warn('Sync already in progress');
            return { synced: 0, conflicts: 0, errors: 0 };
        }

        this.syncInProgress = true;
        this.notifyListeners({ status: 'syncing', progress: 0 });

        try {
            // Check if online
            if (!AppState.isOnline) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Cannot sync while offline', 'error');
                }
                return { synced: 0, conflicts: 0, errors: 0 };
            }

            const result = await this.syncDirtyFiles();
            this.lastSyncTime = Date.now();
            localStorage.setItem('last_sync', new Date().toISOString());

            this.notifyListeners({ status: 'completed', ...result });
            return result;
        } catch (error) {
            console.error('Sync failed:', error);
            if (window.UI && UI.showToast) {
                UI.showToast('Sync failed: ' + error.message, 'error');
            }
            this.notifyListeners({ status: 'error', error: error.message });
            return { synced: 0, conflicts: 0, errors: 1 };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync all dirty files to GitHub
     * @returns {Promise<Object>} - { synced, conflicts, errors }
     */
    static async syncDirtyFiles() {
        const dirtyFiles = await LocalStorageManager.getDirtyFiles();

        if (dirtyFiles.length === 0) {
            if (window.UI && UI.showToast) {
                UI.showToast('All files synced', 'success');
            }
            return { synced: 0, conflicts: 0, errors: 0 };
        }

        const results = {
            synced: 0,
            conflicts: 0,
            errors: 0,
            conflictFiles: []
        };

        // Sync each dirty file
        for (let i = 0; i < dirtyFiles.length; i++) {
            const file = dirtyFiles[i];
            this.notifyListeners({
                status: 'syncing',
                progress: (i / dirtyFiles.length) * 100,
                current: file.path
            });

            try {
                const syncResult = await this.pushFile(file.path, file.content, file.githubSHA);

                if (syncResult.conflict) {
                    results.conflicts++;
                    results.conflictFiles.push({
                        path: file.path,
                        localSHA: file.githubSHA,
                        remoteSHA: syncResult.remoteSHA,
                        localModified: file.lastModified,
                        remoteModified: syncResult.remoteModified
                    });
                    await LocalStorageManager.markConflict(file.path);
                } else {
                    results.synced++;
                    await LocalStorageManager.markClean(file.path, syncResult.sha);
                }
            } catch (error) {
                console.error(`Error syncing ${file.path}:`, error);
                results.errors++;
            }
        }

        // Show summary
        this.showSyncSummary(results);

        // Show conflict modal if there are conflicts
        if (results.conflicts > 0 && window.UI && UI.showConflictModal) {
            UI.showConflictModal(results.conflictFiles);
        }

        return results;
    }

    /**
     * Push a single file to GitHub
     * @param {string} path - File path
     * @param {string} content - File content
     * @param {string} localSHA - Local GitHub SHA (may be stale)
     * @returns {Promise<Object>} - { conflict, sha, remoteSHA, remoteModified }
     */
    static async pushFile(path, content, localSHA) {
        const api = new GitHubAPI(AppState.token, AppState.repo);

        // Get current GitHub state
        let currentGitHubFile;
        try {
            currentGitHubFile = await api.request(`/contents/${path}`);
        } catch (error) {
            // File doesn't exist on GitHub yet
            currentGitHubFile = null;
        }

        // Check for conflict
        if (currentGitHubFile && localSHA && currentGitHubFile.sha !== localSHA) {
            // Conflict detected: GitHub file changed since last sync
            return {
                conflict: true,
                remoteSHA: currentGitHubFile.sha,
                remoteModified: currentGitHubFile.size, // Approximate
                sha: null
            };
        }

        // No conflict, push to GitHub
        const sha = currentGitHubFile ? currentGitHubFile.sha : undefined;
        const result = await api.updateFile(path, content, `Sync: ${path}`);

        return {
            conflict: false,
            sha: result.content.sha,
            remoteSHA: null,
            remoteModified: null
        };
    }

    /**
     * Detect conflicts by comparing local SHAs with GitHub SHAs
     * @param {Array} dirtyFiles - Array of dirty file records
     * @returns {Promise<Array>} - Array of conflict objects
     */
    static async detectConflicts(dirtyFiles) {
        const conflicts = [];
        const api = new GitHubAPI(AppState.token, AppState.repo);

        for (const file of dirtyFiles) {
            try {
                const githubFile = await api.request(`/contents/${file.path}`);

                if (file.githubSHA && githubFile.sha !== file.githubSHA) {
                    conflicts.push({
                        path: file.path,
                        localSHA: file.githubSHA,
                        remoteSHA: githubFile.sha,
                        localModified: file.lastModified,
                        remoteModified: null // GitHub API doesn't provide this easily
                    });
                }
            } catch (error) {
                // File doesn't exist on GitHub, not a conflict
                console.log(`File ${file.path} doesn't exist on GitHub`);
            }
        }

        return conflicts;
    }

    /**
     * Resolve a conflict with user's choice
     * @param {string} path - File path
     * @param {string} resolution - 'keep-local' or 'use-remote'
     * @returns {Promise<void>}
     */
    static async resolveConflict(path, resolution) {
        const api = new GitHubAPI(AppState.token, AppState.repo);
        const localFile = await LocalStorageManager.getFile(path);

        if (!localFile) {
            throw new Error('Local file not found');
        }

        if (resolution === 'keep-local') {
            // Force push local version
            // First get current SHA, then push with that SHA
            const currentGitHub = await api.request(`/contents/${path}`);
            const result = await api.updateFile(path, localFile.content, `Resolve conflict: keep local`);
            await LocalStorageManager.markClean(path, result.content.sha);

            if (window.UI && UI.showToast) {
                UI.showToast('Conflict resolved: kept local version', 'success');
            }
        } else if (resolution === 'use-remote') {
            // Fetch remote and overwrite local
            const remoteContent = await api.getFile(path);
            const githubFile = await api.request(`/contents/${path}`);
            await LocalStorageManager.saveFile(path, remoteContent, false, githubFile.sha);

            if (window.UI && UI.showToast) {
                UI.showToast('Conflict resolved: used remote version', 'success');
            }
        } else {
            throw new Error('Invalid resolution option');
        }
    }

    /**
     * Load all files from GitHub to local storage (initial load)
     * @param {string} viewName - Optional view name to load specific directory
     * @returns {Promise<void>}
     */
    static async loadAllFromGitHub(viewName = null) {
        const api = new GitHubAPI(AppState.token, AppState.repo);

        // Determine which directories to load
        const directories = viewName && window.Viewer && Viewer.config[viewName]
            ? [Viewer.config[viewName].directory]
            : ['md/ToDo', 'md/Shopping', 'md/Projects', 'md/Notes', 'md/Ideas', 'md/People'];

        let totalFiles = 0;

        for (const directory of directories) {
            try {
                const contents = await api.request(`/contents/${directory}`, 'GET', null, true);
                if (!contents) continue;

                const files = contents.filter(item =>
                    item.type === 'file' && item.name.endsWith('.md')
                );

                // Fetch and save each file
                for (const file of files) {
                    try {
                        const content = await api.getFile(file.path);
                        const fileInfo = await api.request(`/contents/${file.path}`);
                        await LocalStorageManager.saveFile(file.path, content, false, fileInfo.sha);
                        totalFiles++;
                    } catch (error) {
                        console.error(`Error loading ${file.path}:`, error);
                    }
                }
            } catch (error) {
                console.error(`Error loading directory ${directory}:`, error);
            }
        }

        console.log(`Loaded ${totalFiles} files from GitHub to local storage`);
        return totalFiles;
    }

    /**
     * Get current sync status
     * @returns {Promise<Object>} - { dirty, conflicts, lastSync }
     */
    static async getSyncStatus() {
        const counts = await LocalStorageManager.getStatusCounts();
        return {
            dirty: counts.dirty,
            conflicts: counts.conflicts,
            synced: counts.synced,
            total: counts.total,
            lastSync: this.lastSyncTime,
            inProgress: this.syncInProgress
        };
    }

    /**
     * Add a listener for sync status updates
     * @param {Function} callback - Called with sync status updates
     */
    static addListener(callback) {
        this.syncListeners.push(callback);
    }

    /**
     * Remove a sync listener
     * @param {Function} callback - Listener to remove
     */
    static removeListener(callback) {
        this.syncListeners = this.syncListeners.filter(l => l !== callback);
    }

    /**
     * Notify all listeners of sync status change
     * @param {Object} status - Status object
     */
    static notifyListeners(status) {
        this.syncListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    /**
     * Show sync summary toast
     * @param {Object} results - Sync results
     */
    static showSyncSummary(results) {
        if (!window.UI || !UI.showToast) return;

        if (results.conflicts > 0) {
            UI.showToast(
                `Synced ${results.synced} files, ${results.conflicts} conflicts detected`,
                'warning'
            );
        } else if (results.errors > 0) {
            UI.showToast(
                `Synced ${results.synced} files, ${results.errors} errors`,
                'error'
            );
        } else {
            UI.showToast(`Synced ${results.synced} files successfully`, 'success');
        }
    }

    /**
     * Perform automatic migration from old queue system
     * @returns {Promise<void>}
     */
    static async performMigration() {
        try {
            const hasData = await LocalStorageManager.hasData();
            const migrated = localStorage.getItem('migrated_to_local_first');
            console.log('Migration check: hasData =', hasData, 'migrated =', migrated);

            if (!hasData) {
                console.log('First run with local-first storage - loading from GitHub...');

                // Process old offline queue first (if any)
                if (AppState.queue && AppState.queue.length > 0) {
                    console.log('Processing existing offline queue...');
                    await QueueManager.processQueue();
                }

                // Load all files from GitHub
                if (window.UI && UI.showToast) {
                    UI.showToast('Loading files from GitHub...', 'info');
                }

                const fileCount = await this.loadAllFromGitHub();
                console.log(`Migration complete: loaded ${fileCount} files`);

                if (fileCount === 0) {
                    console.warn('No files were loaded from GitHub! This might indicate missing directories.');
                    if (window.UI && UI.showToast) {
                        UI.showToast('No files found. Check GitHub repo and reload.', 'warning');
                    }
                    // Don't mark as migrated if no files loaded
                } else {
                    if (window.UI && UI.showToast) {
                        UI.showToast(`Loaded ${fileCount} files`, 'success');
                    }
                    localStorage.setItem('migrated_to_local_first', 'true');
                }
            } else {
                console.log('Local storage already has data, skipping migration');
            }
        } catch (error) {
            console.error('Migration failed:', error);
            if (window.UI && UI.showToast) {
                UI.showToast('Migration failed: ' + error.message, 'error');
            }
            throw error;
        }
    }

    /**
     * Background sync on app open (non-blocking)
     * @returns {Promise<void>}
     */
    static async backgroundSync() {
        if (!AppState.isOnline) return;

        try {
            const status = await this.getSyncStatus();

            if (status.dirty > 0) {
                console.log(`Background sync: ${status.dirty} dirty files`);
                // Don't await - let it happen in background
                this.syncAll().catch(error => {
                    console.error('Background sync failed:', error);
                });
            }
        } catch (error) {
            console.error('Error checking sync status:', error);
        }
    }
}

// Expose globally
window.SyncManager = SyncManager;
