/**
 * Viewer - Shared accordion viewer for ProseMirror-based list tabs
 * Coordinates view loading and delegates to specialized modules
 * Dependencies: ViewerConfig, ProseMirrorSetup, ViewRenderer, LocalStorageManager, SyncManager
 */
const Viewer = {
    /**
     * Check if viewName is a valid view
     * @param {string} viewName - View name to check
     * @returns {boolean} True if valid view
     */
    isView(viewName) {
        return ViewerConfig.isView(viewName);
    },

    /**
     * Load view data from local storage or GitHub
     * @param {string} viewName - View name (tasks, projects, notes, shopping, ideas, people)
     */
    async load(viewName) {
        const config = ViewerConfig.getConfig(viewName);
        if (!config) return;

        const content = document.getElementById(config.contentId);
        if (!content) return;
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            // Try to load from local storage first
            const localFiles = await LocalStorageManager.getAllFiles(config.directory);

            if (localFiles.length === 0) {
                // First load: fetch from GitHub
                console.log(`No local files for ${viewName}, loading from GitHub...`);
                await SyncManager.loadAllFromGitHub(viewName);

                // Try again after loading from GitHub
                const refreshedFiles = await LocalStorageManager.getAllFiles(config.directory);
                if (refreshedFiles.length === 0) {
                    content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                    return;
                }
                localFiles.push(...refreshedFiles);
            }

            // Filter out Done.json
            const files = localFiles.filter(f =>
                !f.path.endsWith('Done.json')
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            // Parse JSON files - content is already a ProseMirror document
            const filesData = files.map(file => {
                let docJSON;
                try {
                    // Parse JSON content
                    docJSON = typeof file.content === 'string'
                        ? JSON.parse(file.content)
                        : file.content;
                } catch (e) {
                    console.error(`Failed to parse JSON for ${file.path}:`, e);
                    docJSON = ProseMirrorSetup.createEmptyDoc();
                }

                return {
                    name: file.path.split('/').pop().replace('.json', ''),
                    path: file.path,
                    docJSON: docJSON,
                    editorView: null, // Will be created when accordion is expanded
                    expanded: false
                };
            });

            AppState.data[viewName] = { directory: config.directory, files: filesData };
            ViewRenderer.render(viewName);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    },

    /**
     * Update source file (save to local storage)
     * @param {string} path - File path
     * @param {Object|string} content - ProseMirror document JSON or JSON string
     * @param {string} message - Commit message (for future use)
     * @param {string} toastMessage - Toast notification message
     */
    async updateSourceFile(path, content, message, toastMessage) {
        // Convert to JSON string if it's an object
        const jsonContent = typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2);

        await FileUpdateManager.updateSourceFile(path, jsonContent, message, toastMessage);
    },

    // Expose module methods
    render: ViewRenderer.render.bind(ViewRenderer),
    toggleAccordion: ViewRenderer.toggleAccordion.bind(ViewRenderer)
};

window.Viewer = Viewer;
