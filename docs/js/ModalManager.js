/**
 * ModalManager - Modal dialogs for Digest and Search
 * Handles digest and search functionality
 * Dependencies: AppState, GitHubAPI, FileExplorer
 */
class ModalManager {
    /**
     * Show daily digest modal
     */
    static async showDigest() {
        const modal = document.getElementById('digestModal');
        modal.classList.remove('hidden');
        await this.loadDigest();
    }

    /**
     * Close digest modal
     */
    static closeDigest() {
        document.getElementById('digestModal').classList.add('hidden');
    }

    /**
     * Load digest content
     */
    static async loadDigest() {
        const digestContent = document.getElementById('digestContent');
        digestContent.innerHTML = '<div class="loading">Loading digest...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Read tasks from ToDo.md
            const todoContent = await api.getFile('md/ToDo/ToDo.md').catch(() => '');

            // Parse Today and Soon tasks
            const todayTasks = [];
            const soonTasks = [];
            let currentSection = null;

            todoContent.split('\n').forEach(line => {
                if (line.includes('## Today')) {
                    currentSection = 'today';
                    return;
                }
                if (line.includes('## Soon')) {
                    currentSection = 'soon';
                    return;
                }
                if (line.includes('## Long term')) {
                    currentSection = null;
                    return;
                }

                const taskMatch = line.match(/^- \[ \] (.+)$/);
                if (taskMatch) {
                    if (currentSection === 'today') {
                        todayTasks.push(taskMatch[1]);
                    } else if (currentSection === 'soon') {
                        soonTasks.push(taskMatch[1]);
                    }
                }
            });

            // Get active projects
            const projectsDir = await api.request('/contents/md/Projects', 'GET', null, true);
            const activeProjects = (projectsDir || [])
                .filter(item => item.type === 'file' && item.name.endsWith('.md'))
                .map(item => item.name.replace('.md', '').replace(/-/g, ' '));

            // Build digest HTML
            let html = `<div class="digest-content">`;
            html += `<h3>Daily Digest - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>`;

            if (todayTasks.length > 0) {
                html += `<div class="digest-section">`;
                html += `<h4>Today (${todayTasks.length} ${todayTasks.length === 1 ? 'task' : 'tasks'})</h4>`;
                html += `<ul>`;
                todayTasks.forEach(task => {
                    html += `<li>${task}</li>`;
                });
                html += `</ul></div>`;
            }

            if (soonTasks.length > 0) {
                html += `<div class="digest-section">`;
                html += `<h4>Soon (${soonTasks.length} ${soonTasks.length === 1 ? 'task' : 'tasks'})</h4>`;
                html += `<ul>`;
                soonTasks.slice(0, 5).forEach(task => {
                    html += `<li>${task}</li>`;
                });
                html += `</ul></div>`;
            }

            if (activeProjects.length > 0) {
                html += `<div class="digest-section">`;
                html += `<h4>Active Projects (${activeProjects.length})</h4>`;
                html += `<ul>`;
                activeProjects.slice(0, 5).forEach(project => {
                    html += `<li>${project}</li>`;
                });
                html += `</ul></div>`;
            }

            if (todayTasks.length === 0 && soonTasks.length === 0 && activeProjects.length === 0) {
                html += `<div class="empty-state">All clear! No urgent tasks or active projects.</div>`;
            }

            html += `</div>`;
            digestContent.innerHTML = html;
        } catch (error) {
            digestContent.innerHTML = `<div class="error">Error loading digest: ${error.message}</div>`;
        }
    }

    /**
     * Show search modal
     */
    static async showSearch() {
        const modal = document.getElementById('searchModal');
        modal.classList.remove('hidden');

        const searchInput = document.getElementById('searchInput');
        searchInput.focus();

        // Remove old event listener if exists and add new one
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                this.performSearch(query);
            } else {
                document.getElementById('searchResults').innerHTML = '<div class="empty-state">Enter at least 2 characters to search.</div>';
            }
        });
    }

    /**
     * Close search modal
     */
    static closeSearch() {
        document.getElementById('searchModal').classList.add('hidden');
    }

    /**
     * Perform search across files
     * @param {string} query - Search query
     */
    static async performSearch(query) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="loading">Searching...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Search in simplified directories
            const searchPaths = [
                'md/ToDo',
                'md/Shopping',
                'md/Projects',
                'md/Notes',
                'md/Ideas',
                'md/People'
            ];

            const fetchPromises = searchPaths.map(async path => {
                const contents = await api.request(`/contents/${path}`, 'GET', null, true);
                if (!contents) return [];

                const files = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));

                // Search file contents
                const matchedFiles = await Promise.all(files.map(async file => {
                    try {
                        const content = await api.getFile(file.path);
                        const lowerQuery = query.toLowerCase();
                        const lowerContent = content.toLowerCase();
                        const lowerName = file.name.toLowerCase();

                        if (lowerName.includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
                            return { ...file, folder: path };
                        }
                        return null;
                    } catch (e) {
                        return null;
                    }
                }));

                return matchedFiles.filter(f => f !== null);
            });

            const results = await Promise.all(fetchPromises);
            const allFiles = results.flat();

            if (allFiles.length === 0) {
                searchResults.innerHTML = `<div class="empty-state">No results found for "${query}".</div>`;
                return;
            }

            let html = '<div class="search-results-list">';

            allFiles.forEach(file => {
                const name = file.name.replace('.md', '');
                const folder = file.folder.replace('md/', '').replace(/\//g, ' > ');
                html += `
                    <div class="search-result-item" onclick="ModalManager.closeSearch(); FileExplorer.viewFileInModal('${file.path}', '${file.name}')">
                        <div class="search-result-name">${name}</div>
                        <div class="search-result-path">${folder}</div>
                    </div>
                `;
            });

            html += '</div>';
            searchResults.innerHTML = html;
        } catch (error) {
            searchResults.innerHTML = `<div class="error">Error searching: ${error.message}</div>`;
        }
    }
}

// Expose globally
window.ModalManager = ModalManager;
