/**
 * FileUpdateManager - Shared utility for file updates
 * Centralizes the logic for saving files and updating UI state
 * Dependencies: LocalStorageManager, UI
 */
class FileUpdateManager {
    /**
     * Update source file (save to local storage)
     * @param {string} path - File path
     * @param {string} content - New content
     * @param {string} message - Commit message (for future use)
     * @param {string} toastMessage - Toast notification message
     */
    static async updateSourceFile(path, content, message, toastMessage) {
        // Save to local storage immediately (local-first)
        await LocalStorageManager.saveFile(path, content, true);

        // Show instant feedback
        if (toastMessage && window.UI && UI.showToast) {
            UI.showToast('Saved locally', 'success');
        }

        // Update sync badge
        if (window.UI && UI.updateSyncBadge) {
            UI.updateSyncBadge();
        }
    }
}

// Expose globally
window.FileUpdateManager = FileUpdateManager;
