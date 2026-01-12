/**
 * ViewerConfig - Configuration for view-based list rendering
 * Provides view-specific settings like directories, content IDs, and empty messages
 * Dependencies: None
 */
class ViewerConfig {
    static config = {
        tasks: {
            directory: 'md/ToDo',
            contentId: 'tasksContent',
            emptyMessage: 'No files found'
        },
        projects: {
            directory: 'md/Projects',
            contentId: 'projectsContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        notes: {
            directory: 'md/Notes',
            contentId: 'notesContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        shopping: {
            directory: 'md/Shopping',
            contentId: 'shoppingContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        ideas: {
            directory: 'md/Ideas',
            contentId: 'ideasContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        },
        people: {
            directory: 'md/People',
            contentId: 'peopleContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        }
    };

    /**
     * Check if a view name is valid
     * @param {string} viewName - The view name to validate
     * @returns {boolean} True if view exists in config
     */
    static isView(viewName) {
        return Boolean(this.config[viewName]);
    }

    /**
     * Get configuration for a specific view
     * @param {string} viewName - The view name
     * @returns {object|null} View configuration or null if not found
     */
    static getConfig(viewName) {
        return this.config[viewName] || null;
    }
}

// Expose globally
window.ViewerConfig = ViewerConfig;
