/**
 * FileExplorer - File viewing and navigation
 * Handles file browser modal and file viewing
 * Dependencies: AppState, GitHubAPI, MarkdownUtils, LocalStorageManager, ViewerConfig, Navigation
 */
class FileExplorer {
    static fileGestureState = null;
    static ignoreFileClickUntil = 0;
    static currentFilePath = null;
    static currentFileName = null;
    static moveDialogBound = false;

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
        this.currentFilePath = null;
        this.currentFileName = null;
    }

    static bindMoveFolderDialog() {
        if (this.moveDialogBound) return;
        this.moveDialogBound = true;

        const modal = document.getElementById('moveFileModal');
        if (!modal) return;

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                this.closeMoveFolderDialog();
            }
        });

        const list = document.getElementById('moveFolderList');
        if (!list) return;

        list.addEventListener('click', async event => {
            const button = event.target.closest('[data-directory]');
            if (!button) return;
            const targetDirectory = button.dataset.directory;
            const path = modal.dataset.path;
            if (!targetDirectory || !path) return;
            await this.moveFileToDirectory(path, targetDirectory);
            this.closeMoveFolderDialog();
        });
    }

    static showMoveFolderDialog(path) {
        this.bindMoveFolderDialog();
        const modal = document.getElementById('moveFileModal');
        const list = document.getElementById('moveFolderList');
        if (!modal || !list) return;

        const targets = this.getMoveTargets();
        if (!targets.length) {
            if (window.UI && UI.showToast) {
                UI.showToast('No target folders found', 'error');
            }
            return;
        }

        const currentDirectory = path.split('/').slice(0, -1).join('/');
        const options = targets
            .filter(target => target.directory !== currentDirectory)
            .map(target => {
                const label = target.directory.replace('md/', '').replace(/\//g, ' > ');
                return `
                    <button type="button" class="btn btn-secondary move-folder-option" data-directory="${target.directory}">
                        ${label}
                    </button>
                `;
            })
            .join('');

        list.innerHTML = options || '<div class="empty-state">No other folders available.</div>';
        modal.dataset.path = path;
        modal.classList.remove('hidden');
    }

    static closeMoveFolderDialog() {
        const modal = document.getElementById('moveFileModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.dataset.path = '';
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

            const highlightMap = {};
            try {
                const localFiles = await LocalStorageManager.getAllFiles();
                localFiles.forEach(file => {
                    const metadata = MarkdownUtils.extractHeaderMetadata(file.content || '');
                    if (metadata.highlight) {
                        highlightMap[file.path] = metadata.highlight;
                    }
                });
            } catch (error) {
                console.warn('Unable to read local file highlights', error);
            }
            this.fileHighlightCache = highlightMap;

            let html = '<div class="file-tree-list">';

            flatResults.forEach(dir => {
                html += `<div class="file-tree-folder">`;
                html += `<div class="file-tree-folder-name">${dir.label}</div>`;
                html += `<ul class="file-tree-items">`;

                dir.files.forEach(file => {
                    const highlightClass = highlightMap[file.path] ? ` highlight-${highlightMap[file.path]}` : '';
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
        fileContent.dataset.path = path;
        fileContentBody.innerHTML = '<div class="loading">Loading file...</div>';
        this.currentFilePath = path;
        this.currentFileName = filename;
        this.bindMoveFolderDialog();

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

    static getMoveTargets() {
        if (!window.ViewerConfig || !ViewerConfig.config) return [];
        const seen = new Set();
        return Object.values(ViewerConfig.config)
            .map(config => config.directory)
            .filter(dir => {
                if (!dir || seen.has(dir)) return false;
                seen.add(dir);
                return true;
            })
            .map(directory => ({ directory }));
    }

    static findViewNameByDirectory(directory) {
        if (!window.ViewerConfig || !ViewerConfig.config) return null;
        const entries = Object.entries(ViewerConfig.config);
        for (const [viewName, config] of entries) {
            if (config.directory === directory) {
                return viewName;
            }
        }
        return null;
    }

    static async moveCurrentFile() {
        const path = this.currentFilePath;
        if (!path) {
            if (window.UI && UI.showToast) {
                UI.showToast('No file selected to move', 'error');
            }
            return;
        }
        this.showMoveFolderDialog(path);
    }

    static async moveFileByPath(path) {
        if (!path) return;
        this.currentFilePath = path;
        this.currentFileName = path.split('/').pop();
        await this.moveCurrentFile();
    }

    static async moveFileToDirectory(path, targetDirectory) {
        if (!path || !targetDirectory) return;
        const filename = path.split('/').pop();
        const currentDirectory = path.split('/').slice(0, -1).join('/');
        const newPath = `${targetDirectory}/${filename}`;

        if (newPath === path || targetDirectory === currentDirectory) {
            if (window.UI && UI.showToast) {
                UI.showToast('File is already in that folder', 'info');
            }
            return;
        }

        const existingLocal = await LocalStorageManager.getFile(newPath);
        if (existingLocal) {
            if (window.UI && UI.showToast) {
                UI.showToast('A file with that name already exists in the target folder', 'error');
            }
            return;
        }

        if (AppState.isOnline) {
            try {
                const api = new GitHubAPI(AppState.token, AppState.repo);
                const existingRemote = await api.request(`/contents/${newPath}`, 'GET', null, true);
                if (existingRemote) {
                    if (window.UI && UI.showToast) {
                        UI.showToast('A file with that name already exists in the target folder', 'error');
                    }
                    return;
                }
            } catch (error) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Failed to check target folder: ' + error.message, 'error');
                }
                return;
            }
        }

        let localFile = await LocalStorageManager.getFile(path);
        let content = localFile ? localFile.content : null;
        let githubSHA = localFile ? localFile.githubSHA : null;

        if (!content && AppState.isOnline) {
            try {
                const api = new GitHubAPI(AppState.token, AppState.repo);
                content = await api.getFile(path);
            } catch (error) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Failed to load file content: ' + error.message, 'error');
                }
                return;
            }
        }

        if (!content) {
            if (window.UI && UI.showToast) {
                UI.showToast('File not available locally to move', 'error');
            }
            return;
        }

        const ensured = MarkdownUtils.ensureFileId(content);
        content = ensured.content;

        await LocalStorageManager.saveFile(newPath, content, true, githubSHA);
        await LocalStorageManager.deleteFile(path);

        if (window.FileExplorer && FileExplorer.moveFileHighlight) {
            FileExplorer.moveFileHighlight(path, newPath);
        }

        this.currentFilePath = newPath;
        this.currentFileName = filename;
        const fileContent = document.getElementById('fileContent');
        if (fileContent) {
            fileContent.dataset.path = newPath;
        }

        const oldView = this.findViewNameByDirectory(currentDirectory);
        const newView = this.findViewNameByDirectory(targetDirectory);
        if (window.Navigation && Navigation.loadSharedView) {
            if (oldView) {
                await Navigation.loadSharedView(oldView);
            }
            if (newView && newView !== oldView) {
                await Navigation.loadSharedView(newView);
            }
        }

        if (AppState.isOnline) {
            await this.loadFileTree();
        }

        if (window.UI && UI.showToast) {
            UI.showToast('File moved', 'success');
        }
        if (window.UI && UI.updateSyncBadge) {
            UI.updateSyncBadge();
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

    static moveFileHighlight(oldPath, newPath) {
        if (!oldPath || !newPath || oldPath === newPath) return;
        if (!this.fileHighlightCache || !this.fileHighlightCache[oldPath]) return;
        this.fileHighlightCache[newPath] = this.fileHighlightCache[oldPath];
        delete this.fileHighlightCache[oldPath];
    }

    static getFileHighlight(path, viewName = null, fileIndex = null) {
        if (viewName && Number.isInteger(fileIndex)) {
            const data = AppState.data[viewName];
            const file = data?.files?.[fileIndex];
            if (file && file.path === path) {
                return file.highlight || null;
            }
        }
        return this.fileHighlightCache && this.fileHighlightCache[path]
            ? this.fileHighlightCache[path]
            : null;
    }

    static getFileHighlightClass(path, viewName = null, fileIndex = null) {
        const highlight = this.getFileHighlight(path, viewName, fileIndex);
        return highlight ? ` highlight-${highlight}` : '';
    }

    static async applyFileHighlight(path, color) {
        if (!path) return;
        const highlight = color === 'none' ? null : color;
        let localFile = await LocalStorageManager.getFile(path);

        if (!localFile) {
            try {
                const api = new GitHubAPI(AppState.token, AppState.repo);
                const content = await api.getFile(path);
                localFile = { content, githubSHA: null };
            } catch (error) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Unable to load file for highlight', 'error');
                }
                return;
            }
        }

        const currentHighlight = MarkdownUtils.extractHeaderMetadata(localFile.content || '').highlight;
        const updatedContent = MarkdownUtils.setFileHighlight(localFile.content || '', highlight);
        if (currentHighlight !== highlight) {
            await FileUpdateManager.updateSourceFile(path, updatedContent, 'Update file highlight', null);
        }

        if (!this.fileHighlightCache) this.fileHighlightCache = {};
        if (highlight) {
            this.fileHighlightCache[path] = highlight;
        } else {
            delete this.fileHighlightCache[path];
        }

        const itemEl = document.querySelector(`.file-tree-item[data-path="${path}"]`);
        if (itemEl) {
            itemEl.classList.remove('highlight-yellow', 'highlight-green', 'highlight-blue', 'highlight-pink');
            if (highlight) {
                itemEl.classList.add(`highlight-${highlight}`);
            }
        }

        const accordionEl = document.querySelector(`.accordion-item[data-file-path="${path}"]`);
        if (accordionEl) {
            accordionEl.classList.remove('highlight-yellow', 'highlight-green', 'highlight-blue', 'highlight-pink');
            if (highlight) {
                accordionEl.classList.add(`highlight-${highlight}`);
            }
        }

        if (window.ViewRenderer && ViewRenderer.findFileContextByPath) {
            const context = ViewRenderer.findFileContextByPath(path);
            if (context && context.file) {
                context.file.highlight = highlight;
            }
        }
    }
}

// Expose globally
window.FileExplorer = FileExplorer;
