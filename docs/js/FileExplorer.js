/**
 * FileExplorer - File viewing and navigation
 * Handles file browser modal and file viewing
 * Dependencies: AppState, GitHubAPI, MarkdownUtils
 */
class FileExplorer {
    static fileGestureState = null;
    static ignoreFileClickUntil = 0;

    /**
     * Show file viewer modal
     */
    static async showFileViewer() {
        const modal = document.getElementById('fileViewerModal');
        modal.classList.remove('hidden');
        await this.loadFileTree();
    }

    /**
     * Close file viewer modal
     */
    static closeFileViewer() {
        document.getElementById('fileViewerModal').classList.add('hidden');
        document.getElementById('fileContent').classList.add('hidden');
        document.getElementById('fileTree').classList.remove('hidden');
    }

    /**
     * Close file content view (return to tree)
     */
    static closeFileContent() {
        document.getElementById('fileContent').classList.add('hidden');
        document.getElementById('fileTree').classList.remove('hidden');
    }

    /**
     * Load file tree
     */
    static async loadFileTree() {
        const fileTree = document.getElementById('fileTree');
        fileTree.innerHTML = '<div class="loading">Loading files...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Recursively get all md files from the md directory
            const getAllFiles = async (path, label = null) => {
                const contents = await api.request(`/contents/${path}`, 'GET', null, true);
                if (!contents) return [];

                const files = [];
                const subdirs = [];

                contents.forEach(item => {
                    if (item.type === 'file' && item.name.endsWith('.md')) {
                        files.push(item);
                    } else if (item.type === 'dir' && item.name !== 'templates' && item.name !== 'notes') {
                        subdirs.push(item);
                    }
                });

                const result = {
                    path,
                    label: label || path.replace('md/', '').replace(/\//g, ' > ').replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' > '),
                    files
                };

                // Get files from subdirectories
                const subResults = await Promise.all(
                    subdirs.map(dir => getAllFiles(dir.path))
                );

                return [result, ...subResults.flat()];
            };

            const allResults = await getAllFiles('md');
            const flatResults = allResults.flat().filter(r => r.files && r.files.length > 0);

            let html = '<div class="file-tree-list">';

            flatResults.forEach(dir => {
                html += `<div class="file-tree-folder">`;
                html += `<div class="file-tree-folder-name">${dir.label}</div>`;
                html += `<ul class="file-tree-items">`;

                dir.files.forEach(file => {
                    const highlightClass = this.getFileHighlightClass(file.path);
                    html += `
                        <li class="file-tree-item${highlightClass}" data-path="${file.path}" data-name="${file.name}">
                            <svg class="icon icon-file" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            ${file.name}
                        </li>
                    `;
                });

                html += `</ul></div>`;
            });

            html += '</div>';
            fileTree.innerHTML = html;
            this.bindFileTreeInteractions(fileTree);
        } catch (error) {
            fileTree.innerHTML = `<div class="error">Error loading files: ${error.message}</div>`;
        }
    }

    /**
     * View file in modal
     * @param {string} path - File path
     * @param {string} filename - File name
     */
    static async viewFile(path, filename) {
        const fileContent = document.getElementById('fileContent');
        const fileTree = document.getElementById('fileTree');
        const fileTitle = document.getElementById('fileTitle');
        const fileContentBody = document.getElementById('fileContentBody');

        fileTree.classList.add('hidden');
        fileContent.classList.remove('hidden');
        fileTitle.textContent = filename;
        fileContentBody.innerHTML = '<div class="loading">Loading file...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const content = await api.getFile(path);

            // Convert markdown to HTML
            const htmlContent = MarkdownUtils.markdownToHtml(content);
            fileContentBody.innerHTML = htmlContent;
        } catch (error) {
            fileContentBody.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
        }
    }

    /**
     * View file in modal (opens modal first)
     * @param {string} path - File path
     * @param {string} filename - File name
     */
    static async viewFileInModal(path, filename) {
        await this.showFileViewer();
        await this.viewFile(path, filename);
    }

    /**
     * View file inline (for notes view)
     * @param {string} path - File path
     * @param {string} filename - File name
     */
    static async viewFileInline(path, filename) {
        const content = document.getElementById('notesContent');
        content.innerHTML = '<div class="loading">Loading file...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const fileContent = await api.getFile(path);

            // Parse markdown to HTML
            const html = MarkdownUtils.markdownToHtml(fileContent);

            content.innerHTML = `
                <div class="file-content">
                    <div class="file-content-header">
                        <button class="btn btn-small" onclick="Navigation.loadNotes()">
                            <svg class="icon icon-arrow-left" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m12 19-7-7 7-7" />
                                <path d="M19 12H5" />
                            </svg>
                            Back to list
                        </button>
                        <h3>${filename}</h3>
                    </div>
                    <div class="markdown-content">${html}</div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
        }
    }

    /**
     * Show inbox log file
     */
    static async showInboxLog() {
        if (window.UI && UI.showToast) {
            UI.showToast('Loading inbox log...', 'info');
        }

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const content = await api.getFile('md/inbox-log.md');

            // Show in file viewer
            await this.showFileViewer();
            document.getElementById('fileTree').classList.add('hidden');
            document.getElementById('fileContent').classList.remove('hidden');
            document.getElementById('fileTitle').textContent = 'inbox-log.md';
            document.getElementById('fileContentBody').innerHTML = MarkdownUtils.markdownToHtml(content);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Error loading inbox log: ' + error.message, 'error');
            }
        }
    }

    /**
     * Create new file
     * @param {string} directory - Directory path
     * @param {string} fileName - File name (without .md)
     * @param {string} viewName - View name for reload
     */
    static async createNewFile(directory, fileName, viewName) {
        const api = new GitHubAPI(AppState.token, AppState.repo);
        const filePath = `${directory}/${fileName}.md`;
        const fileId = window.MarkdownUtils ? MarkdownUtils.generateFileId() : `id-${Date.now()}`;
        const content = `<!-- id:${fileId} -->\n# ${fileName}\n\n- First item\n`;

        try {
            if (AppState.isOnline) {
                await api.updateFile(filePath, content, `Create new file: ${fileName}`);
                if (window.UI && UI.showToast) {
                    UI.showToast('File created', 'success');
                }
                if (window.Navigation && Navigation.loadSharedView) {
                    await Navigation.loadSharedView(viewName);
                }
            } else {
                if (window.UI && UI.showToast) {
                    UI.showToast('Cannot create files while offline', 'error');
                }
            }
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Failed to create file: ' + error.message, 'error');
            }
        }
    }

    /**
     * Show create file dialog
     * @param {string} viewName - View name
     */
    static showCreateFileDialog(viewName) {
        if (!window.ViewerConfig || !ViewerConfig.config || !ViewerConfig.config[viewName]) return;
        const fileName = prompt('Enter file name (without .md):');
        if (!fileName) return;

        const directory = ViewerConfig.config[viewName].directory;
        this.createNewFile(directory, fileName, viewName);
    }

    static bindFileTreeInteractions(fileTree) {
        if (fileTree.dataset.fileTreeBound) return;
        fileTree.dataset.fileTreeBound = 'true';

        fileTree.addEventListener('contextmenu', (event) => {
            const itemEl = event.target.closest('.file-tree-item');
            if (!itemEl) return;
            event.preventDefault();
            if (window.HighlightMenu && HighlightMenu.showFileMenu) {
                HighlightMenu.showFileMenu(itemEl, itemEl.dataset.path);
            }
            this.ignoreFileClickUntil = Date.now() + 400;
        });

        fileTree.addEventListener('click', (event) => {
            if (Date.now() < this.ignoreFileClickUntil) return;
            const itemEl = event.target.closest('.file-tree-item');
            if (!itemEl) return;
            const path = itemEl.dataset.path;
            const name = itemEl.dataset.name;
            if (!path || !name) return;
            this.viewFile(path, name);
        });

        fileTree.addEventListener('pointerdown', (event) => {
            const itemEl = event.target.closest('.file-tree-item');
            if (!itemEl) return;

            if (window.HighlightMenu && HighlightMenu.hideHighlightMenu) {
                HighlightMenu.hideHighlightMenu();
            }

            const gestureState = {
                pointerId: event.pointerId,
                itemEl,
                startX: event.clientX,
                startY: event.clientY,
                longPressTriggered: false,
                longPressTimer: null
            };

            gestureState.longPressTimer = window.setTimeout(() => {
                gestureState.longPressTriggered = true;
                if (window.HighlightMenu && HighlightMenu.showFileMenu) {
                    HighlightMenu.showFileMenu(itemEl, itemEl.dataset.path);
                }
            }, 500);

            if (itemEl.setPointerCapture) {
                itemEl.setPointerCapture(event.pointerId);
            }
            this.fileGestureState = gestureState;
        });

        fileTree.addEventListener('pointermove', (event) => {
            const state = this.fileGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            const dx = event.clientX - state.startX;
            const dy = event.clientY - state.startY;
            if (!state.longPressTriggered && Math.abs(dx) + Math.abs(dy) > 24) {
                window.clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            }
        });

        fileTree.addEventListener('pointerup', (event) => {
            const state = this.fileGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            window.clearTimeout(state.longPressTimer);
            if (state.longPressTriggered) {
                this.ignoreFileClickUntil = Date.now() + 400;
            }
            this.fileGestureState = null;
        });

        fileTree.addEventListener('pointercancel', (event) => {
            const state = this.fileGestureState;
            if (!state || state.pointerId !== event.pointerId) return;
            window.clearTimeout(state.longPressTimer);
            this.fileGestureState = null;
        });
    }

    static getFileHighlights() {
        try {
            return JSON.parse(localStorage.getItem('file_highlights') || '{}');
        } catch (error) {
            return {};
        }
    }

    static saveFileHighlights(highlights) {
        localStorage.setItem('file_highlights', JSON.stringify(highlights));
    }

    static moveFileHighlight(oldPath, newPath) {
        if (!oldPath || !newPath || oldPath === newPath) return;
        const highlights = this.getFileHighlights();
        if (!highlights[oldPath]) return;
        highlights[newPath] = highlights[oldPath];
        delete highlights[oldPath];
        this.saveFileHighlights(highlights);
    }

    static getFileHighlight(path) {
        const highlights = this.getFileHighlights();
        return highlights[path] || null;
    }

    static getFileHighlightClass(path) {
        const highlight = this.getFileHighlight(path);
        return highlight ? ` highlight-${highlight}` : '';
    }

    static applyFileHighlight(path, color) {
        const highlights = this.getFileHighlights();
        if (color === 'none') {
            delete highlights[path];
        } else {
            highlights[path] = color;
        }
        this.saveFileHighlights(highlights);

        const itemEl = document.querySelector(`.file-tree-item[data-path="${path}"]`);
        if (itemEl) {
            itemEl.classList.remove('highlight-yellow', 'highlight-green', 'highlight-blue', 'highlight-pink');
            if (color !== 'none') {
                itemEl.classList.add(`highlight-${color}`);
            }
        }

        const accordionEl = document.querySelector(`.accordion-item[data-file-path="${path}"]`);
        if (accordionEl) {
            accordionEl.classList.remove('highlight-yellow', 'highlight-green', 'highlight-blue', 'highlight-pink');
            if (color !== 'none') {
                accordionEl.classList.add(`highlight-${color}`);
            }
        }
    }
}

// Expose globally
window.FileExplorer = FileExplorer;
