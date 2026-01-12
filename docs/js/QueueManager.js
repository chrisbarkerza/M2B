/**
 * QueueManager - Offline action queue management
 * Manages queuing and processing of offline actions
 * Dependencies: AppState, GitHubAPI, UI (toast)
 */
class QueueManager {
    static async enqueue(action) {
        AppState.queue.push(action);
        localStorage.setItem('offline_queue', JSON.stringify(AppState.queue));
        if (window.UI && UI.updateQueueDisplay) {
            UI.updateQueueDisplay();
        }
    }

    static async processQueue() {
        if (!AppState.isOnline || AppState.queue.length === 0) return;

        const queue = [...AppState.queue];
        AppState.queue = [];

        for (const action of queue) {
            try {
                if (action.type === 'capture') {
                    // Use issuesRepo for captures
                    const issuesApi = new GitHubAPI(AppState.token, AppState.issuesRepo);
                    await issuesApi.createIssue(action.data.title, action.data.body);
                } else if (action.type === 'update_file') {
                    // Use data repo for file updates
                    const dataApi = new GitHubAPI(AppState.token, AppState.repo);
                    await dataApi.updateFile(action.data.path, action.data.content, action.data.message);
                }
                if (window.UI && UI.showToast) {
                    UI.showToast(`Synced: ${action.description}`, 'success');
                }
            } catch (error) {
                // Re-queue failed actions
                AppState.queue.push(action);
                if (window.UI && UI.showToast) {
                    UI.showToast(`Sync failed: ${action.description}`, 'error');
                }
            }
        }

        localStorage.setItem('offline_queue', JSON.stringify(AppState.queue));
        if (window.UI && UI.updateQueueDisplay) {
            UI.updateQueueDisplay();
        }
    }

    static loadQueue() {
        const stored = localStorage.getItem('offline_queue');
        if (stored) {
            AppState.queue = JSON.parse(stored);
        }
    }
}

// Expose globally
window.QueueManager = QueueManager;
