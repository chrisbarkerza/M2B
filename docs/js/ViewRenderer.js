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
            const highlightClass = file.highlight ? `highlight-${file.highlight}` : '';

            // Count unchecked tasks from ProseMirror document
            const itemCount = this.countUncheckedTasks(file.docJSON);

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header ${highlightClass}" onclick="ViewRenderer.toggleAccordion('${viewName}', ${fileIndex})">`;
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

        // Bind long-press handlers to accordion headers
        this.bindHeaderGestures(viewName);

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
     * Count all list items in ProseMirror document
     * @param {Object} docJSON - ProseMirror document JSON
     * @returns {number} Count of all list items
     */
    static countUncheckedTasks(docJSON) {
        let count = 0;

        function traverse(node) {
            if (node.type === 'list') {
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

    /**
     * Bind long-press and drag gestures to accordion headers
     * @param {string} viewName - The view name
     */
    static bindHeaderGestures(viewName) {
        const data = AppState.data[viewName];
        if (!data || !data.files) return;

        const headers = document.querySelectorAll('.accordion-header');

        headers.forEach((header, fileIndex) => {
            let gestureState = null;

            const handlePointerDown = (event) => {
                const accordion = header.closest('.accordion-item');
                const isExpanded = accordion.classList.contains('expanded');

                // Only allow long-press when collapsed
                if (isExpanded) return;

                event.stopPropagation();

                gestureState = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    lastX: event.clientX,
                    lastY: event.clientY,
                    longPressTriggered: false,
                    dragging: false,
                    longPressTimer: null
                };

                gestureState.longPressTimer = window.setTimeout(() => {
                    gestureState.longPressTriggered = true;
                    header.classList.add('long-press');
                }, 500);

                if (header.setPointerCapture) {
                    header.setPointerCapture(event.pointerId);
                }
            };

            const handlePointerMove = (event) => {
                if (!gestureState || gestureState.pointerId !== event.pointerId) return;

                const dx = event.clientX - gestureState.startX;
                const dy = event.clientY - gestureState.startY;
                gestureState.lastX = event.clientX;
                gestureState.lastY = event.clientY;

                // Start dragging if long-press triggered and moved
                if (gestureState.longPressTriggered && !gestureState.dragging && Math.abs(dy) > 10) {
                    gestureState.dragging = true;
                    this.startFileDrag(viewName, fileIndex, header);
                }

                if (gestureState.dragging) {
                    this.updateFileDragPosition(viewName, event.clientY);
                    event.preventDefault();
                }
            };

            const handlePointerUp = (event) => {
                if (!gestureState || gestureState.pointerId !== event.pointerId) return;

                window.clearTimeout(gestureState.longPressTimer);

                if (gestureState.dragging) {
                    this.finishFileDrag(viewName);
                } else if (gestureState.longPressTriggered) {
                    // Show highlight menu for file
                    HighlightMenu.showHighlightMenuForFile(header, viewName, fileIndex);
                }

                header.classList.remove('long-press');
                gestureState = null;
            };

            const handlePointerCancel = (event) => {
                if (!gestureState || gestureState.pointerId !== event.pointerId) return;
                window.clearTimeout(gestureState.longPressTimer);
                if (gestureState.dragging) {
                    this.cleanupFileDrag(viewName);
                }
                header.classList.remove('long-press');
                gestureState = null;
            };

            // Prevent default context menu on long-press
            const handleContextMenu = (event) => {
                const accordion = header.closest('.accordion-item');
                const isExpanded = accordion.classList.contains('expanded');
                if (!isExpanded) {
                    event.preventDefault();
                }
            };

            header.addEventListener('pointerdown', handlePointerDown);
            header.addEventListener('pointermove', handlePointerMove);
            header.addEventListener('pointerup', handlePointerUp);
            header.addEventListener('pointercancel', handlePointerCancel);
            header.addEventListener('contextmenu', handleContextMenu);
        });
    }

    /**
     * Start file drag
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {HTMLElement} header - Header element
     */
    static startFileDrag(viewName, fileIndex, header) {
        const accordion = header.closest('.accordion-item');

        if (!this.fileDragState) {
            this.fileDragState = {};
        }

        this.fileDragState.viewName = viewName;
        this.fileDragState.dragIndex = fileIndex;
        this.fileDragState.currentIndex = fileIndex;
        this.fileDragState.accordion = accordion;

        // Add dragging class
        accordion.classList.add('dragging');

        // Create placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'file-drag-placeholder';
        placeholder.style.height = accordion.offsetHeight + 'px';
        this.fileDragState.placeholder = placeholder;

        // Insert placeholder after accordion
        accordion.parentNode.insertBefore(placeholder, accordion.nextSibling);
    }

    /**
     * Update file drag position
     * @param {string} viewName - View name
     * @param {number} clientY - Current Y position
     */
    static updateFileDragPosition(viewName, clientY) {
        if (!this.fileDragState) return;

        const accordions = Array.from(document.querySelectorAll('.accordion-item'));
        const draggedAccordion = this.fileDragState.accordion;

        // Find the accordion closest to the cursor
        let closestAccordion = null;
        let closestDistance = Infinity;

        accordions.forEach(acc => {
            if (acc === draggedAccordion) return;

            const rect = acc.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const distance = Math.abs(clientY - center);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestAccordion = acc;
            }
        });

        if (closestAccordion) {
            const closestRect = closestAccordion.getBoundingClientRect();
            const placeholder = this.fileDragState.placeholder;

            // Insert placeholder before or after closest accordion
            if (clientY < closestRect.top + closestRect.height / 2) {
                closestAccordion.parentNode.insertBefore(placeholder, closestAccordion);
            } else {
                closestAccordion.parentNode.insertBefore(placeholder, closestAccordion.nextSibling);
            }
        }
    }

    /**
     * Finish file drag
     * @param {string} viewName - View name
     */
    static finishFileDrag(viewName) {
        if (!this.fileDragState) return;

        const data = AppState.data[viewName];
        if (!data || !data.files) return;

        const draggedAccordion = this.fileDragState.accordion;
        const placeholder = this.fileDragState.placeholder;

        // Calculate new index based on placeholder position
        const accordions = Array.from(document.querySelectorAll('.accordion-item'));
        const newIndex = Array.from(placeholder.parentNode.children).indexOf(placeholder);
        const oldIndex = this.fileDragState.dragIndex;

        // Move the dragged accordion to placeholder position
        placeholder.parentNode.insertBefore(draggedAccordion, placeholder);
        placeholder.remove();

        // Update data order
        const [movedFile] = data.files.splice(oldIndex, 1);
        const adjustedNewIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
        data.files.splice(adjustedNewIndex, 0, movedFile);

        // Cleanup
        draggedAccordion.classList.remove('dragging');
        this.fileDragState = null;

        // Re-render to update file indices
        this.render(viewName);

        if (window.UI && UI.showToast) {
            UI.showToast('File reordered', 'success');
        }
    }

    /**
     * Cleanup file drag
     * @param {string} viewName - View name
     */
    static cleanupFileDrag(viewName) {
        if (!this.fileDragState) return;

        const draggedAccordion = this.fileDragState.accordion;
        const placeholder = this.fileDragState.placeholder;

        if (draggedAccordion) {
            draggedAccordion.classList.remove('dragging');
        }

        if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }

        this.fileDragState = null;
    }
}

// Expose globally
window.ViewRenderer = ViewRenderer;
