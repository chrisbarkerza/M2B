/**
 * ViewRenderer - Convert data to UI, manage DOM structure
 * Renders accordion-style views from parsed data
 * Dependencies: AppState, ViewerConfig, ChecklistParser
 */
class ViewRenderer {
    static fileHeaderGestureState = null;
    static ignoreFileHeaderClickUntil = 0;

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
            const fileHighlightClass = window.FileExplorer && FileExplorer.getFileHighlightClass
                ? FileExplorer.getFileHighlightClass(file.path)
                : '';

            html += `<div class="accordion-item ${expandedClass}${fileHighlightClass}" data-file-index="${fileIndex}" data-file-path="${file.path}">`;
            html += `<div class="accordion-header" data-view="${viewName}" data-file-index="${fileIndex}" tabindex="0">`;
            html += `<span class="accordion-icon">&#9654;</span>`;
            html += `<span class="file-name">${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="checklist">`;

            const collapsedIndents = [];
            file.items.forEach((item, itemIndex) => {
                if (item.checked) return;

                const indentLevel = item.indent || 0;
                while (collapsedIndents.length && indentLevel <= collapsedIndents[collapsedIndents.length - 1]) {
                    collapsedIndents.pop();
                }

                const hasChildren = ViewRenderer.itemHasChildren(file.items, itemIndex);
                const collapseState = item.collapseState || null;
                const isCollapsed = collapseState === 'collapsed' && hasChildren;
                const isHidden = collapsedIndents.length > 0;

                if (!isHidden) {
                    const highlightClass = item.highlight ? ` highlight-${item.highlight}` : '';
                    const indentStyle = `padding-left: ${indentLevel * 20 + 6}px;`;
                    const bulletClass = hasChildren ? ` bullet caret${isCollapsed ? '' : ' expanded'}` : 'bullet';
                    const bullet = hasChildren ? '&#9654;' : '&#8226;';
                    html += `
                        <div class="checklist-item${highlightClass}" data-view="${viewName}" data-file-index="${fileIndex}" data-item-index="${itemIndex}" style="${indentStyle}" tabindex="0">
                            <span class="${bulletClass}">${bullet}</span>
                            <span class="checklist-text">${item.text}</span>
                        </div>
                    `;
                }

                if (isCollapsed) {
                    collapsedIndents.push(indentLevel);
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

        this.bindFileHeaderInteractions(content, viewName);
    }

    static bindFileHeaderInteractions(content) {
        if (content.dataset.fileHeaderBound) return;
        content.dataset.fileHeaderBound = 'true';

        content.addEventListener('click', event => {
            if (Date.now() < this.ignoreFileHeaderClickUntil) return;
            const header = event.target.closest('.accordion-header');
            if (!header) return;
            this.toggleAccordion(header.dataset.view, parseInt(header.dataset.fileIndex, 10));
        });

        content.addEventListener('keydown', event => {
            const header = event.target.closest('.accordion-header');
            if (!header) return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? event.metaKey : event.ctrlKey;
            if (!modifierKey || !event.shiftKey) return;

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveFile(header.dataset.view, parseInt(header.dataset.fileIndex, 10), -1);
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveFile(header.dataset.view, parseInt(header.dataset.fileIndex, 10), 1);
            }
        });

        content.addEventListener('contextmenu', event => {
            const header = event.target.closest('.accordion-header');
            if (!header) return;
            event.preventDefault();
            this.showFileHighlightMenu(header);
            this.ignoreFileHeaderClickUntil = Date.now() + 400;
        });

        content.addEventListener('pointerdown', event => {
            const header = event.target.closest('.accordion-header');
            if (!header) return;

            const gestureState = {
                pointerId: event.pointerId,
                header,
                startX: event.clientX,
                startY: event.clientY,
                longPressTriggered: false,
                longPressTimer: null
            };

            gestureState.longPressTimer = window.setTimeout(() => {
                gestureState.longPressTriggered = true;
                this.showFileHighlightMenu(header);
            }, 500);

            if (header.setPointerCapture) {
                header.setPointerCapture(event.pointerId);
            }
            this.fileHeaderGestureState = gestureState;
        });

        content.addEventListener('pointermove', event => {
            const state = this.fileHeaderGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            const dx = event.clientX - state.startX;
            const dy = event.clientY - state.startY;
            if (!state.longPressTriggered && Math.abs(dx) + Math.abs(dy) > 24) {
                window.clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            }
        });

        content.addEventListener('pointerup', event => {
            const state = this.fileHeaderGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            window.clearTimeout(state.longPressTimer);
            if (state.longPressTriggered) {
                this.ignoreFileHeaderClickUntil = Date.now() + 400;
            }
            this.fileHeaderGestureState = null;
        });

        content.addEventListener('pointercancel', event => {
            const state = this.fileHeaderGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            window.clearTimeout(state.longPressTimer);
            this.fileHeaderGestureState = null;
        });
    }

    static showFileHighlightMenu(header) {
        const itemEl = header.closest('.accordion-item');
        const path = itemEl ? itemEl.dataset.filePath : null;
        if (!path) return;
        if (window.HighlightMenu && HighlightMenu.showFileMenu) {
            HighlightMenu.showFileMenu(header, path, header.dataset.view, parseInt(header.dataset.fileIndex, 10));
        }
    }

    static async renameFile(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        await this.renameFileByPath(file.path, viewName, fileIndex);
    }

    static findFileContextByPath(path, viewName = null, fileIndex = null) {
        if (viewName && Number.isInteger(fileIndex)) {
            const data = AppState.data[viewName];
            if (data && data.files && data.files[fileIndex]) {
                return { viewName, fileIndex, file: data.files[fileIndex], data };
            }
        }

        const views = Object.keys(AppState.data || {});
        for (const view of views) {
            const data = AppState.data[view];
            if (!data || !data.files) continue;
            const index = data.files.findIndex(file => file.path === path);
            if (index !== -1) {
                return { viewName: view, fileIndex: index, file: data.files[index], data };
            }
        }

        return null;
    }

    static async renameFileByPath(path, viewName = null, fileIndex = null) {
        if (!path) return;
        const context = this.findFileContextByPath(path, viewName, fileIndex);
        const currentName = context ? context.file.name : path.split('/').pop().replace(/\.md$/i, '');

        const newNameRaw = prompt('Rename file (without .md):', currentName);
        if (!newNameRaw) return;
        const newName = newNameRaw.trim().replace(/\.md$/i, '');
        if (!newName || newName === currentName) return;

        const dir = path.split('/').slice(0, -1).join('/');
        const newPath = `${dir}/${newName}.md`;
        if (newPath === path) return;

        const existing = await LocalStorageManager.getFile(newPath);
        if (existing) {
            if (window.UI && UI.showToast) {
                UI.showToast('A file with that name already exists', 'error');
            }
            return;
        }

        const localFile = await LocalStorageManager.getFile(path);
        if (!localFile) {
            if (window.UI && UI.showToast) {
                UI.showToast('File not found in local storage', 'error');
            }
            return;
        }

        let content = localFile.content;
        const ensured = MarkdownUtils.ensureFileId(content);
        content = ensured.content;

        await LocalStorageManager.saveFile(newPath, content, true, localFile.githubSHA);
        await LocalStorageManager.deleteFile(path);
        if (window.FileExplorer && FileExplorer.moveFileHighlight) {
            FileExplorer.moveFileHighlight(path, newPath);
        }

        if (context) {
            context.file.name = newName;
            context.file.path = newPath;
            this.render(context.viewName);
        }

        if (window.UI && UI.updateSyncBadge) {
            UI.updateSyncBadge();
        }
    }

    static async completeFileByPath(path, viewName = null, fileIndex = null) {
        if (!path) return;
        const context = this.findFileContextByPath(path, viewName, fileIndex);
        const fileName = context ? context.file.name : path.split('/').pop().replace(/\.md$/i, '');
        const directory = path.split('/').slice(0, -1).join('/');
        const donePath = `${directory}/Done.md`;
        const today = new Date().toISOString().split('T')[0];

        try {
            const localFile = await LocalStorageManager.getFile(path);
            if (!localFile) {
                if (window.UI && UI.showToast) {
                    UI.showToast('File not found in local storage', 'error');
                }
                return;
            }

            const items = ChecklistParser.parseCheckboxItems(localFile.content);
            const doneFile = await LocalStorageManager.getFile(donePath);
            let doneContent = doneFile
                ? doneFile.content
                : `# ${directory.split('/').pop()} - Completed\n\n<!-- Completed items moved here with completion dates -->\n\n`;

            const cleanedItems = items
                .map(item => item.text.trim())
                .filter(text => text.length > 0);

            if (cleanedItems.length === 0) {
                doneContent += `- [${fileName}] _(${today})_\n`;
            } else {
                cleanedItems.forEach(text => {
                    doneContent += `- [${fileName}] ${text} _(${today})_\n`;
                });
            }

            await LocalStorageManager.saveFile(donePath, doneContent, true, doneFile ? doneFile.githubSHA : null);
            await LocalStorageManager.deleteFile(path);

            if (window.FileExplorer && FileExplorer.applyFileHighlight) {
                FileExplorer.applyFileHighlight(path, 'none');
            }

            if (context) {
                context.data.files.splice(context.fileIndex, 1);
                this.render(context.viewName);
            }

            if (window.UI && UI.showToast) {
                UI.showToast('File moved to Done', 'success');
            }
            if (window.UI && UI.updateSyncBadge) {
                UI.updateSyncBadge();
            }
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Failed to move file: ' + error.message, 'error');
            }
        }
    }

    static async moveFile(viewName, fileIndex, direction) {
        const data = AppState.data[viewName];
        if (!data || !data.files) return;
        const files = data.files;
        const newIndex = fileIndex + direction;
        if (newIndex < 0 || newIndex >= files.length) return;

        if (files.some(file => !file.orderKey)) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const localFile = await LocalStorageManager.getFile(file.path);
                if (!localFile) continue;
                let content = localFile.content;
                const ensured = MarkdownUtils.ensureFileId(content);
                content = ensured.content;
                const orderKey = MarkdownUtils.generateOrderKeyForIndex(i);
                file.orderKey = orderKey;
                content = MarkdownUtils.setOrderKey(content, orderKey);
                await LocalStorageManager.saveFile(file.path, content, true, localFile.githubSHA);
            }
        }

        const moved = files.splice(fileIndex, 1)[0];
        files.splice(newIndex, 0, moved);

        const prevKey = files[newIndex - 1] ? files[newIndex - 1].orderKey : null;
        const nextKey = files[newIndex + 1] ? files[newIndex + 1].orderKey : null;
        const orderKey = MarkdownUtils.generateOrderKeyBetween(prevKey, nextKey);
        moved.orderKey = orderKey;

        const localFile = await LocalStorageManager.getFile(moved.path);
        if (!localFile) return;
        let content = localFile.content;
        const ensured = MarkdownUtils.ensureFileId(content);
        content = ensured.content;
        content = MarkdownUtils.setOrderKey(content, orderKey);
        await LocalStorageManager.saveFile(moved.path, content, true, localFile.githubSHA);

        this.render(viewName);
        if (window.UI && UI.updateSyncBadge) {
            UI.updateSyncBadge();
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

    /**
     * Check if an item has children (next items with deeper indent)
     * @param {Array} items - Array of items
     * @param {number} itemIndex - Index of current item
     * @returns {boolean} True if item has children
     */
    static itemHasChildren(items, itemIndex) {
        const current = items[itemIndex];
        if (!current) return false;
        const currentIndent = current.indent || 0;
        for (let i = itemIndex + 1; i < items.length; i++) {
            const next = items[i];
            if (next.checked) continue;
            const nextIndent = next.indent || 0;
            if (nextIndent <= currentIndent) {
                return false;
            }
            return true;
        }
        return false;
    }
}

// Expose globally
window.ViewRenderer = ViewRenderer;
