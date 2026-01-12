/**
 * ViewRenderer - Convert data to UI, manage DOM structure
 * Renders accordion-style views from parsed data
 * Dependencies: AppState, ViewerConfig, ChecklistParser
 */
class ViewRenderer {
    /**
     * Render view data as accordion HTML
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
            const itemCount = file.items.filter(i => !i.checked).length;

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header" onclick="ViewRenderer.toggleAccordion('${viewName}', ${fileIndex})">`;
            html += `<span class="accordion-icon">&#9654;</span>`;
            html += `<span>${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="checklist">`;

            file.items.forEach((item, itemIndex) => {
                if (!item.checked) {
                    const highlightClass = item.highlight ? ` highlight-${item.highlight}` : '';
                    const indentLevel = item.indent || 0;
                    const indentStyle = `padding-left: ${indentLevel * 20}px;`;
                    html += `
                        <div class="checklist-item${highlightClass}" data-view="${viewName}" data-file-index="${fileIndex}" data-item-index="${itemIndex}" style="${indentStyle}" tabindex="0">
                            <span class="bullet">⦿</span>
                            <span class="checklist-text">${item.text}</span>
                        </div>
                    `;
                }
            });

            html += `</div></div></div>`;
        });

        html += '</div>';
        content.innerHTML = html;

        // Bind interactions via GestureHandler
        if (window.GestureHandler) {
            GestureHandler.bindInteractions(content);
        }
    }

    /**
     * Toggle accordion section open/closed
     * @param {string} viewName - The view name
     * @param {number} fileIndex - Index of file/accordion to toggle
     */
    static toggleAccordion(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        data.files[fileIndex].expanded = !data.files[fileIndex].expanded;
        this.render(viewName);
    }

    /**
     * Get unchecked items from a file
     * @param {object} file - File object with items array
     * @returns {Array} Array of unchecked items
     */
    static getUncheckedItems(file) {
        return file.items.filter(item => !item.checked);
    }
}

// Expose globally
window.ViewRenderer = ViewRenderer;
