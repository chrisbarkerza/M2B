/**
 * FileExplorer - File viewing and navigation
 * Handles file browser modal and file viewing
 * Dependencies: AppState, GitHubAPI, MarkdownUtils
 */
class FileExplorer {
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
                    html += `
                        <li class="file-tree-item" onclick="FileExplorer.viewFile('${file.path}', '${file.name}')">
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
        const content = `# ${fileName}\n\n- First item\n`;

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
}

// Expose globally
window.FileExplorer = FileExplorer;
