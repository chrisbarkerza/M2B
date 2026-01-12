/**
 * ViewRenderer - Render ProseMirror editors in accordion view
 * Renders accordion-style views with ProseMirror editors
 * Dependencies: AppState, ViewerConfig, ProseMirrorSetup
 */
class ViewRenderer {
    /**
     * Render view data as accordion with ProseMirror editors
     * @param {string} viewName - The view to render (tasks, projects, etc.)
     */
    static render(viewName) {
        const config = ViewerConfig.getConfig(viewName);
        if (!config) return;

        const content = document.getElementById(config.contentId);
        const data = AppState.data[viewName];

        if (!data || !data.files || data.files.length === 0) {
            content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
            return;
        }

        let html = '<div class="accordion">';

        data.files.forEach((file, fileIndex) => {
            const expandedClass = file.expanded ? 'expanded' : '';

            // Count unchecked tasks from ProseMirror document
            const itemCount = this.countUncheckedTasks(file.docJSON);

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header" onclick="ViewRenderer.toggleAccordion('${viewName}', ${fileIndex})">`;
            html += `<span class="accordion-icon">&#9654;</span>`;
            html += `<span>${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="prosemirror-container" data-view="${viewName}" data-file-index="${fileIndex}"></div>`;
            html += `</div></div>`;
        });

        html += '</div>';
        content.innerHTML = html;

        // Create ProseMirror editors for expanded accordions
        data.files.forEach((file, fileIndex) => {
            if (file.expanded) {
                this.createEditor(viewName, fileIndex);
            }
        });
    }

    /**
     * Create ProseMirror editor for a file
     * @param {string} viewName - The view name
     * @param {number} fileIndex - Index of file
     */
    static createEditor(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        const container = document.querySelector(
            `.accordion-item[data-file-index="${fileIndex}"] .prosemirror-container`
        );

        if (!container) return;

        // Destroy existing editor if any
        if (file.editorView) {
            file.editorView.destroy();
        }

        // Create new editor
        file.editorView = ProseMirrorSetup.createEditor(
            container,
            file.docJSON,
            (newDocJSON) => {
                // Save changes to local storage when document changes
                file.docJSON = newDocJSON;
                Viewer.updateSourceFile(
                    file.path,
                    newDocJSON,
                    'Update file',
                    'Changes saved locally'
                );

                // Update item count in header
                this.updateItemCount(viewName, fileIndex);
            }
        );
    }

    /**
     * Toggle accordion section open/closed
     * @param {string} viewName - The view name
     * @param {number} fileIndex - Index of file/accordion to toggle
     */
    static toggleAccordion(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        file.expanded = !file.expanded;

        // Destroy editor if collapsing
        if (!file.expanded && file.editorView) {
            file.editorView.destroy();
            file.editorView = null;
        }

        this.render(viewName);
    }

    /**
     * Count unchecked tasks in ProseMirror document
     * @param {Object} docJSON - ProseMirror document JSON
     * @returns {number} Count of unchecked tasks
     */
    static countUncheckedTasks(docJSON) {
        let count = 0;

        function traverse(node) {
            if (node.type === 'list' &&
                node.attrs &&
                node.attrs.kind === 'task' &&
                node.attrs.checked === false) {
                count++;
            }
            if (node.content) {
                node.content.forEach(traverse);
            }
        }

        traverse(docJSON);
        return count;
    }

    /**
     * Update item count in accordion header
     * @param {string} viewName - The view name
     * @param {number} fileIndex - Index of file
     */
    static updateItemCount(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        const itemCount = this.countUncheckedTasks(file.docJSON);

        const header = document.querySelector(
            `.accordion-item[data-file-index="${fileIndex}"] .accordion-header span:last-child`
        );

        if (header) {
            header.textContent = `(${itemCount})`;
        }
    }
}

// Expose globally
window.ViewRenderer = ViewRenderer;
