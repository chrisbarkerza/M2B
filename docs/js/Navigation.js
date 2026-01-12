/**
 * Navigation - View switching and navigation
 * Handles all view navigation and switching
 * Dependencies: AppState, Viewer, ModalManager, FileExplorer
 */
class Navigation {
    /**
     * Setup navigation buttons
     */
    static setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
    }

    /**
     * Switch to a different view
     * @param {string} viewName - View name to switch to
     */
    static switchView(viewName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');

        AppState.currentView = viewName;

        // Update app title
        const titleMap = {
            'capture': 'Capture',
            'shopping': 'Shopping',
            'notes': 'Notes',
            'projects': 'Projects',
            'tasks': 'Tasks',
            'ideas': 'Ideas',
            'people': 'People'
        };
        const appTitle = document.getElementById('appTitle');
        if (appTitle) {
            const titleText = appTitle.childNodes[appTitle.childNodes.length - 1];
            if (titleText && titleText.nodeType === Node.TEXT_NODE) {
                titleText.textContent = titleMap[viewName] || 'M2B';
            }
        }

        // Show/hide appropriate + button
        document.getElementById('addShoppingBtn').style.display = viewName === 'shopping' ? '' : 'none';
        document.getElementById('addNotesBtn').style.display = viewName === 'notes' ? '' : 'none';
        document.getElementById('addProjectsBtn').style.display = viewName === 'projects' ? '' : 'none';
        document.getElementById('addTasksBtn').style.display = viewName === 'tasks' ? '' : 'none';

        // Load data for view (always refresh)
        if (window.Viewer && Viewer.isView(viewName)) {
            Viewer.load(viewName);
        }
    }

    /**
     * Setup more menu
     */
    static setupMoreMenu() {
        document.querySelectorAll('.menu-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleMoreAction(action);
            });
        });
    }

    /**
     * Handle more menu action
     * @param {string} action - Action to handle
     */
    static handleMoreAction(action) {
        switch (action) {
            case 'projects':
                this.switchView('projects');
                break;
            case 'files':
                FileExplorer.showFileViewer();
                break;
            case 'digest':
                ModalManager.showDigest();
                break;
            case 'search':
                ModalManager.showSearch();
                break;
            case 'ideas':
                this.switchView('ideas');
                break;
            case 'people':
                this.switchView('people');
                break;
            case 'inbox':
                FileExplorer.showInboxLog();
                break;
        }
    }

    /**
     * Load shared view
     * @param {string} viewName - View name
     */
    static async loadSharedView(viewName) {
        if (window.Viewer && Viewer.isView(viewName)) {
            await Viewer.load(viewName);
        }
    }

    /**
     * Load tasks view
     */
    static async loadTasks() {
        await this.loadSharedView('tasks');
    }

    /**
     * Load projects view
     */
    static async loadProjects() {
        await this.loadSharedView('projects');
    }

    /**
     * Load notes view
     */
    static async loadNotes() {
        await this.loadSharedView('notes');
    }

    /**
     * Load shopping view
     */
    static async loadShopping() {
        await this.loadSharedView('shopping');
    }

    /**
     * Load ideas view
     */
    static async loadIdeas() {
        await this.loadSharedView('ideas');
    }

    /**
     * Load people view
     */
    static async loadPeople() {
        await this.loadSharedView('people');
    }
}

// Expose globally
window.Navigation = Navigation;
