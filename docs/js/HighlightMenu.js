/**
 * HighlightMenu - Context menu for color-coding items and files
 * Manages the popup menu for applying highlights and actions
 * Dependencies: AppState, ItemActions, ViewRenderer, FileExplorer, UI
 */
class HighlightMenu {
    static highlightMenu = null;
    static highlightMenuJustOpened = false;

    /**
     * Ensure highlight menu exists in DOM
     * @returns {HTMLElement} The menu element
     */
    static ensureHighlightMenu() {
        if (this.highlightMenu) return this.highlightMenu;

        const menu = document.createElement('div');
        menu.id = 'highlightMenu';
        menu.className = 'highlight-menu hidden';

        menu.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            if (action === 'close') {
                this.hideHighlightMenu();
                return;
            }

            const targetType = menu.dataset.targetType;
            const viewName = menu.dataset.view;
            const fileIndex = parseInt(menu.dataset.fileIndex, 10);
            const itemIndex = parseInt(menu.dataset.itemIndex, 10);
            const path = menu.dataset.path;

            if (button.dataset.color) {
                const color = button.dataset.color;
                if (targetType === 'item') {
                    ItemActions.applyHighlight(viewName, fileIndex, itemIndex, color);
                } else if (targetType === 'file' && window.FileExplorer && FileExplorer.applyFileHighlight) {
                    FileExplorer.applyFileHighlight(path, color);
                }
                this.hideHighlightMenu();
                return;
            }

            if (!action) return;
            this.hideHighlightMenu();

            if (targetType === 'item') {
                if (action === 'done') {
                    ItemActions.completeItem(viewName, fileIndex, itemIndex);
                } else if (action === 'indent') {
                    ItemActions.indentItem(viewName, fileIndex, itemIndex);
                } else if (action === 'outdent') {
                    ItemActions.outdentItem(viewName, fileIndex, itemIndex);
                } else if (action === 'move-mode') {
                    this.enterItemMoveMode(viewName, fileIndex, itemIndex);
                }
            } else if (targetType === 'file') {
                if (action === 'done') {
                    ViewRenderer.completeFileByPath(path, viewName, fileIndex);
                } else if (action === 'rename') {
                    ViewRenderer.renameFileByPath(path, viewName, fileIndex);
                } else if (action === 'move-mode') {
                    this.enterFileMoveMode(viewName, fileIndex);
                } else if (action === 'move-folder') {
                    if (window.FileExplorer && FileExplorer.moveFileByPath) {
                        FileExplorer.moveFileByPath(path);
                    }
                }
            }
        });

        document.addEventListener('click', event => {
            if (menu.classList.contains('hidden')) return;
            if (this.highlightMenuJustOpened) {
                this.highlightMenuJustOpened = false;
                return;
            }
            if (menu.contains(event.target)) return;
            this.hideHighlightMenu();
        });

        window.addEventListener('scroll', () => {
            this.hideHighlightMenu();
        }, true);

        document.body.appendChild(menu);
        this.highlightMenu = menu;
        return menu;
    }

    static resolveFileContext(path) {
        if (!path) return null;
        const views = Object.keys(AppState.data || {});
        for (const viewName of views) {
            const data = AppState.data[viewName];
            if (!data || !data.files) continue;
            const fileIndex = data.files.findIndex(file => file.path === path);
            if (fileIndex !== -1) {
                return { viewName, fileIndex };
            }
        }
        return null;
    }

    static buildMenuHeader(title) {
        return `
            <div class="highlight-menu-header">
                <div class="highlight-menu-title">${title}</div>
                <button type="button" class="menu-close-btn" data-action="close" aria-label="Close">x</button>
            </div>
        `;
    }

    static buildColorRow(current) {
        const colors = [
            { id: 'yellow', label: 'Yellow' },
            { id: 'green', label: 'Green' },
            { id: 'blue', label: 'Blue' },
            { id: 'pink', label: 'Pink' },
            { id: 'none', label: 'Clear' }
        ];

        let html = '<div class="color-row">';
        colors.forEach(color => {
            const activeClass = color.id === current ? ' active' : '';
            html += `<button type="button" class="color-square${activeClass}" data-color="${color.id}" title="${color.label}">
                <span class="highlight-swatch highlight-${color.id}"></span>
            </button>`;
        });
        html += '</div>';
        return html;
    }

    /**
     * Show highlight menu at item position
     * @param {HTMLElement} itemEl - Item element
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static showHighlightMenu(itemEl, viewName, fileIndex, itemIndex) {
        const menu = this.ensureHighlightMenu();
        const data = AppState.data[viewName];
        const item = data?.files?.[fileIndex]?.items?.[itemIndex];
        const current = item?.highlight || 'none';

        let html = this.buildMenuHeader('Item');
        html += this.buildColorRow(current);
        html += '<button type="button" class="menu-action-btn" data-action="done">Done</button>';
        html += '<button type="button" class="menu-action-btn" data-action="indent">Indent</button>';
        html += '<button type="button" class="menu-action-btn" data-action="outdent">Outdent</button>';
        html += '<button type="button" class="menu-action-btn" data-action="move-mode">Move mode</button>';

        menu.innerHTML = html;
        menu.dataset.targetType = 'item';
        menu.dataset.view = viewName;
        menu.dataset.fileIndex = String(fileIndex);
        menu.dataset.itemIndex = String(itemIndex);
        menu.dataset.path = '';

        const rect = itemEl.getBoundingClientRect();
        const top = rect.bottom + window.scrollY + 6;
        const left = rect.left + window.scrollX;
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.classList.remove('hidden');
        this.highlightMenuJustOpened = true;
        window.setTimeout(() => {
            this.highlightMenuJustOpened = false;
        }, 0);
    }

    /**
     * Show highlight menu for file actions
     * @param {HTMLElement} targetEl - File element
     * @param {string} path - File path
     * @param {string|null} viewName - Optional view name
     * @param {number|null} fileIndex - Optional file index
     */
    static showFileMenu(targetEl, path, viewName = null, fileIndex = null) {
        const menu = this.ensureHighlightMenu();
        const resolved = viewName && Number.isInteger(fileIndex) ? { viewName, fileIndex } : this.resolveFileContext(path);
        const current = window.FileExplorer && FileExplorer.getFileHighlight
            ? FileExplorer.getFileHighlight(path, resolved ? resolved.viewName : null, resolved ? resolved.fileIndex : null) || 'none'
            : 'none';

        let html = this.buildMenuHeader('File');
        html += this.buildColorRow(current);
        html += '<button type="button" class="menu-action-btn" data-action="done">Done</button>';
        html += '<button type="button" class="menu-action-btn" data-action="rename">Rename</button>';
        html += '<button type="button" class="menu-action-btn" data-action="move-mode">Move mode</button>';
        html += '<button type="button" class="menu-action-btn" data-action="move-folder">Move folder</button>';

        menu.innerHTML = html;
        menu.dataset.targetType = 'file';
        menu.dataset.view = resolved ? resolved.viewName : '';
        menu.dataset.fileIndex = resolved ? String(resolved.fileIndex) : '';
        menu.dataset.itemIndex = '';
        menu.dataset.path = path;

        const rect = targetEl.getBoundingClientRect();
        const top = rect.bottom + window.scrollY + 6;
        const left = rect.left + window.scrollX;
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.classList.remove('hidden');
        this.highlightMenuJustOpened = true;
        window.setTimeout(() => {
            this.highlightMenuJustOpened = false;
        }, 0);
    }

    static enterItemMoveMode(viewName, fileIndex, itemIndex) {
        const config = ViewerConfig.getConfig(viewName);
        if (!config) return;
        const content = document.getElementById(config.contentId);
        const itemEl = content?.querySelector(`.checklist-item[data-file-index="${fileIndex}"][data-item-index="${itemIndex}"]`);
        if (itemEl) {
            if (window.MoveModeManager) {
                MoveModeManager.enterItem(viewName, fileIndex, itemIndex, itemEl);
            } else {
                itemEl.focus();
            }
        }
        if (window.UI && UI.showToast) {
            UI.showToast('Move mode: use Arrow keys to move', 'info');
        }
    }

    static enterFileMoveMode(viewName, fileIndex) {
        if (!viewName || !Number.isInteger(fileIndex)) {
            if (window.UI && UI.showToast) {
                UI.showToast('Move mode: use Cmd+Shift+Arrow on a file header', 'info');
            }
            return;
        }
        const header = document.querySelector(`.accordion-header[data-view="${viewName}"][data-file-index="${fileIndex}"]`);
        if (header) {
            if (window.MoveModeManager) {
                MoveModeManager.enterFile(viewName, fileIndex, header);
            } else {
                header.focus();
            }
        }
        if (window.UI && UI.showToast) {
            UI.showToast('Move mode: use Arrow keys to move', 'info');
        }
    }

    /**
     * Hide the highlight menu
     */
    static hideHighlightMenu() {
        if (!this.highlightMenu) return;
        this.highlightMenu.classList.add('hidden');
    }
}

// Expose globally
window.HighlightMenu = HighlightMenu;
