/**
 * AppState - Global application state
 * Centralized state container for the entire application
 * Dependencies: None
 */
const AppState = {
    token: localStorage.getItem('github_token') || '',
    repo: localStorage.getItem('github_repo') || 'chrisbarkerza/M2B-Data',
    issuesRepo: 'chrisbarkerza/M2B', // Issues go to public M2B repo, data comes from M2B-Data
    isOnline: navigator.onLine,
    currentView: 'tasks',
    data: {
        tasks: null,
        projects: null,
        notes: null,
        shopping: null,
        ideas: null,
        people: null
    },
    queue: [],
    syncStatus: {
        dirty: 0,
        conflicts: 0,
        synced: 0,
        total: 0,
        lastSync: null,
        inProgress: false
    }
};

// Expose globally
window.AppState = AppState;
