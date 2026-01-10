/**
 * M2B PWA - Second Brain Application
 */

// App State
const AppState = {
    token: localStorage.getItem('github_token') || '',
    repo: localStorage.getItem('github_repo') || 'chrisbarkerza/M2B',
    isOnline: navigator.onLine,
    currentView: 'capture',
    currentContext: 'personal',
    currentDomain: 'all',
    data: {
        shopping: null,
        tasks: { personal: { urgent: null, longerTerm: null }, work: { urgent: null, longerTerm: null } },
        ideas: [],
        projects: [],
        people: []
    },
    queue: []
};

// GitHub API Helper
class GitHubAPI {
    constructor(token, repo) {
        this.token = token;
        this.repo = repo;
        this.baseUrl = `https://api.github.com/repos/${repo}`;
    }

    async request(endpoint, method = 'GET', body = null) {
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async getFile(path) {
        const data = await this.request(`/contents/${path}`);
        return atob(data.content); // Decode base64
    }

    async updateFile(path, content, message) {
        // Get current file to get SHA
        let sha;
        try {
            const current = await this.request(`/contents/${path}`);
            sha = current.sha;
        } catch (e) {
            // File doesn't exist, that's ok
        }

        return this.request(`/contents/${path}`, 'PUT', {
            message,
            content: btoa(content), // Encode to base64
            sha
        });
    }

    async createIssue(title, body) {
        return this.request('/issues', 'POST', {
            title,
            body,
            labels: ['capture']
        });
    }
}

// Data Parser - Parse markdown files with frontmatter
class DataParser {
    static parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) return { frontmatter: {}, content };

        const frontmatter = {};
        const lines = match[1].split('\n');
        lines.forEach(line => {
            const [key, ...values] = line.split(':');
            if (key && values.length) {
                frontmatter[key.trim()] = values.join(':').trim();
            }
        });

        return { frontmatter, content: match[2] };
    }

    static parseShoppingList(content) {
        const { frontmatter, content: body } = this.parseFrontmatter(content);
        const sections = {};
        let currentSection = 'Uncategorized';

        body.split('\n').forEach(line => {
            const sectionMatch = line.match(/^## (.+)$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                sections[currentSection] = [];
                return;
            }

            const itemMatch = line.match(/^- \[([ x])\] (.+)$/);
            if (itemMatch) {
                sections[currentSection] = sections[currentSection] || [];
                sections[currentSection].push({
                    checked: itemMatch[1] === 'x',
                    text: itemMatch[2]
                });
            }
        });

        return { frontmatter, sections };
    }

    static parseTaskList(content) {
        const { frontmatter, content: body } = this.parseFrontmatter(content);
        const tasks = { active: [], completed: [] };
        let currentSection = 'active';

        body.split('\n').forEach(line => {
            if (line.includes('## Active')) {
                currentSection = 'active';
                return;
            }
            if (line.includes('## Completed')) {
                currentSection = 'completed';
                return;
            }

            const taskMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)$/);
            if (taskMatch) {
                const dueMatch = taskMatch[3].match(/\(due: ([^)]+)\)/);
                const confidenceMatch = taskMatch[3].match(/\[confidence: (\d+)\]/);

                tasks[currentSection].push({
                    checked: taskMatch[1] === 'x',
                    text: taskMatch[2],
                    due: dueMatch ? dueMatch[1] : null,
                    confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : null,
                    raw: line
                });
            }
        });

        return { frontmatter, tasks };
    }

    static serializeShoppingList(frontmatter, sections) {
        let content = '---\n';
        Object.entries(frontmatter).forEach(([key, value]) => {
            content += `${key}: ${value}\n`;
        });
        content += '---\n\n# Shopping List\n';

        Object.entries(sections).forEach(([section, items]) => {
            if (section === 'Shopping List') return; // Skip the main heading
            content += `\n## ${section}\n`;
            items.forEach(item => {
                const checkbox = item.checked ? '[x]' : '[ ]';
                content += `- ${checkbox} ${item.text}\n`;
            });
        });

        return content;
    }
}

// Offline Queue Manager
class QueueManager {
    static async enqueue(action) {
        AppState.queue.push(action);
        localStorage.setItem('offline_queue', JSON.stringify(AppState.queue));
        UI.updateQueueDisplay();
    }

    static async processQueue() {
        if (!AppState.isOnline || AppState.queue.length === 0) return;

        const api = new GitHubAPI(AppState.token, AppState.repo);
        const queue = [...AppState.queue];
        AppState.queue = [];

        for (const action of queue) {
            try {
                if (action.type === 'capture') {
                    await api.createIssue(action.data.title, action.data.body);
                } else if (action.type === 'update_file') {
                    await api.updateFile(action.data.path, action.data.content, action.data.message);
                }
                UI.showToast(`✓ Synced: ${action.description}`, 'success');
            } catch (error) {
                // Re-queue failed actions
                AppState.queue.push(action);
                UI.showToast(`✗ Sync failed: ${action.description}`, 'error');
            }
        }

        localStorage.setItem('offline_queue', JSON.stringify(AppState.queue));
        UI.updateQueueDisplay();
    }

    static loadQueue() {
        const stored = localStorage.getItem('offline_queue');
        if (stored) {
            AppState.queue = JSON.parse(stored);
        }
    }
}

// UI Controller
class UI {
    static init() {
        this.setupNavigation();
        this.setupCapture();
        this.setupSettings();
        this.setupOnlineStatus();
        this.setupTaskTabs();
        this.setupDomainFilters();

        // Load data if token exists
        if (AppState.token) {
            this.syncData();
        } else {
            this.showSettings();
        }

        QueueManager.loadQueue();
        this.updateQueueDisplay();
    }

    static setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
    }

    static switchView(viewName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');

        AppState.currentView = viewName;

        // Load data for view
        if (viewName === 'shopping' && !AppState.data.shopping) {
            this.loadShopping();
        } else if (viewName === 'tasks' && !AppState.data.tasks[AppState.currentContext].urgent) {
            this.loadTasks(AppState.currentContext);
        } else if (viewName === 'ideas' && AppState.data.ideas.length === 0) {
            this.loadIdeas();
        }
    }

    static setupCapture() {
        const captureBtn = document.getElementById('captureBtn');
        const captureInput = document.getElementById('captureInput');

        captureBtn.addEventListener('click', async () => {
            const text = captureInput.value.trim();
            if (!text) return;

            captureBtn.disabled = true;
            captureBtn.innerHTML = '<span class="spinner"></span> Capturing...';

            try {
                const lines = text.split('\n');
                const title = lines[0].trim().slice(0, 80) || 'Capture';
                const body = lines.slice(1).join('\n').trim() || text;

                if (AppState.isOnline && AppState.token) {
                    const api = new GitHubAPI(AppState.token, AppState.repo);
                    await api.createIssue(title, body);
                    this.showToast('✓ Captured! Processing...', 'success');
                } else {
                    await QueueManager.enqueue({
                        type: 'capture',
                        data: { title, body },
                        description: text.substring(0, 50) + '...'
                    });
                    this.showToast('✓ Queued for sync', 'info');
                }

                captureInput.value = '';
            } catch (error) {
                this.showToast('✗ Capture failed: ' + error.message, 'error');
            } finally {
                captureBtn.disabled = false;
                captureBtn.innerHTML = '<span class="btn-icon">📥</span> Capture';
            }
        });

        // Submit on Ctrl+Enter
        captureInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                captureBtn.click();
            }
        });
    }

    static setupSettings() {
        const settingsBtn = document.getElementById('settingsBtn');
        const modal = document.getElementById('settingsModal');
        const closeBtn = modal.querySelector('.close-btn');
        const saveBtn = document.getElementById('saveSettingsBtn');
        const testBtn = document.getElementById('testConnectionBtn');

        settingsBtn.addEventListener('click', () => this.showSettings());
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        saveBtn.addEventListener('click', () => {
            AppState.token = document.getElementById('githubToken').value;
            AppState.repo = document.getElementById('githubRepo').value;

            localStorage.setItem('github_token', AppState.token);
            localStorage.setItem('github_repo', AppState.repo);

            this.showToast('✓ Settings saved', 'success');
            modal.classList.add('hidden');
            this.syncData();
        });

        testBtn.addEventListener('click', async () => {
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';

            try {
                const token = document.getElementById('githubToken').value;
                const repo = document.getElementById('githubRepo').value;
                const api = new GitHubAPI(token, repo);
                await api.request('/contents/README.md');
                this.showToast('✓ Connection successful!', 'success');
            } catch (error) {
                this.showToast('✗ Connection failed: ' + error.message, 'error');
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = 'Test Connection';
            }
        });

        document.getElementById('clearCacheBtn').addEventListener('click', () => {
            if (confirm('Clear all cached data?')) {
                AppState.data = {
                    shopping: null,
                    tasks: { personal: { urgent: null, longerTerm: null }, work: { urgent: null, longerTerm: null } },
                    ideas: [],
                    projects: [],
                    people: []
                };
                this.showToast('✓ Cache cleared', 'success');
            }
        });
    }

    static showSettings() {
        document.getElementById('githubToken').value = AppState.token;
        document.getElementById('githubRepo').value = AppState.repo;
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    static setupOnlineStatus() {
        const indicator = document.getElementById('offlineIndicator');

        const updateStatus = () => {
            AppState.isOnline = navigator.onLine;
            indicator.classList.toggle('hidden', AppState.isOnline);

            if (AppState.isOnline) {
                QueueManager.processQueue();
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
    }

    static setupTaskTabs() {
        document.querySelectorAll('#tasksView .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const context = tab.dataset.context;
                document.querySelectorAll('#tasksView .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.currentContext = context;
                this.loadTasks(context);
            });
        });
    }

    static setupDomainFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const domain = btn.dataset.domain;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.currentDomain = domain;
                this.renderIdeas();
            });
        });
    }

    static async syncData() {
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.classList.add('syncing');

        try {
            await QueueManager.processQueue();
            // Clear cached data to force reload
            AppState.data.shopping = null;
            AppState.data.tasks = { personal: { urgent: null, longerTerm: null }, work: { urgent: null, longerTerm: null } };

            // Reload current view
            if (AppState.currentView === 'shopping') {
                await this.loadShopping();
            } else if (AppState.currentView === 'tasks') {
                await this.loadTasks(AppState.currentContext);
            }

            localStorage.setItem('last_sync', new Date().toISOString());
            document.getElementById('lastSync').textContent = new Date().toLocaleString();
            this.showToast('✓ Synced', 'success');
        } catch (error) {
            this.showToast('✗ Sync failed: ' + error.message, 'error');
        } finally {
            syncBtn.classList.remove('syncing');
        }
    }

    static async loadShopping() {
        const content = document.getElementById('shoppingContent');
        content.innerHTML = '<div class="loading">Loading shopping list...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const fileContent = await api.getFile('md/shopping.md');
            const parsed = DataParser.parseShoppingList(fileContent);
            AppState.data.shopping = parsed;

            this.renderShopping();
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading shopping list: ${error.message}</div>`;
        }
    }

    static renderShopping() {
        const content = document.getElementById('shoppingContent');
        const { sections } = AppState.data.shopping;

        let html = '';
        Object.entries(sections).forEach(([section, items]) => {
            if (section === 'Shopping List' || items.length === 0) return;

            html += `<div class="section">`;
            html += `<h3>${section}</h3>`;
            html += `<div class="checklist">`;

            items.forEach((item, index) => {
                html += `
                    <label class="checklist-item ${item.checked ? 'checked' : ''}">
                        <input
                            type="checkbox"
                            ${item.checked ? 'checked' : ''}
                            data-section="${section}"
                            data-index="${index}"
                            onchange="UI.toggleShoppingItem(this)"
                        >
                        <span class="checklist-text">${item.text}</span>
                    </label>
                `;
            });

            html += `</div></div>`;
        });

        content.innerHTML = html;
    }

    static async toggleShoppingItem(checkbox) {
        const section = checkbox.dataset.section;
        const index = parseInt(checkbox.dataset.index);

        AppState.data.shopping.sections[section][index].checked = checkbox.checked;

        // Update frontmatter date
        AppState.data.shopping.frontmatter.updated = new Date().toISOString().split('T')[0];

        const newContent = DataParser.serializeShoppingList(
            AppState.data.shopping.frontmatter,
            AppState.data.shopping.sections
        );

        try {
            if (AppState.isOnline) {
                const api = new GitHubAPI(AppState.token, AppState.repo);
                await api.updateFile('md/shopping.md', newContent, `Update shopping list: ${checkbox.checked ? 'check' : 'uncheck'} ${AppState.data.shopping.sections[section][index].text}`);
                this.showToast('✓ Updated', 'success');
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/shopping.md',
                        content: newContent,
                        message: `Update shopping list (offline)`
                    },
                    description: 'Shopping list update'
                });
                this.showToast('✓ Queued for sync', 'info');
            }
        } catch (error) {
            this.showToast('✗ Update failed: ' + error.message, 'error');
            checkbox.checked = !checkbox.checked; // Revert
        }
    }

    static async loadTasks(context) {
        const content = document.getElementById('tasksContent');
        content.innerHTML = '<div class="loading">Loading tasks...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const urgentContent = await api.getFile(`md/admin/${context}/urgent.md`);
            const longerTermContent = await api.getFile(`md/admin/${context}/longer-term.md`);

            AppState.data.tasks[context].urgent = DataParser.parseTaskList(urgentContent);
            AppState.data.tasks[context].longerTerm = DataParser.parseTaskList(longerTermContent);

            this.renderTasks(context);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading tasks: ${error.message}</div>`;
        }
    }

    static renderTasks(context) {
        const content = document.getElementById('tasksContent');
        const { urgent, longerTerm } = AppState.data.tasks[context];

        let html = '<div class="section"><h3>🔥 Urgent (Due within 7 days)</h3><div class="checklist">';

        urgent.tasks.active.forEach(task => {
            const dueText = task.due ? ` <span class="due-date">(due: ${task.due})</span>` : '';
            html += `
                <label class="checklist-item">
                    <input type="checkbox">
                    <span class="checklist-text"><strong>${task.text}</strong>${dueText}</span>
                </label>
            `;
        });

        html += '</div></div>';

        html += '<div class="section"><h3>📅 Longer Term</h3><div class="checklist">';

        longerTerm.tasks.active.forEach(task => {
            html += `
                <label class="checklist-item">
                    <input type="checkbox">
                    <span class="checklist-text"><strong>${task.text}</strong></span>
                </label>
            `;
        });

        html += '</div></div>';

        content.innerHTML = html;
    }

    static async loadIdeas() {
        // TODO: Implement ideas loading from ideas/ directory
        document.getElementById('ideasContent').innerHTML = '<div class="placeholder">Ideas coming soon...</div>';
    }

    static renderIdeas() {
        // TODO: Implement ideas rendering with domain filtering
    }

    static updateQueueDisplay() {
        const queueSection = document.getElementById('captureQueue');
        const queueList = document.getElementById('queueList');

        if (AppState.queue.length === 0) {
            queueSection.classList.add('hidden');
            return;
        }

        queueSection.classList.remove('hidden');
        queueList.innerHTML = AppState.queue.map(item => `
            <div class="queue-item">
                <span class="queue-icon">⏳</span>
                <span class="queue-text">${item.description}</span>
            </div>
        `).join('');
    }

    static showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.init());
} else {
    UI.init();
}

// Expose UI methods globally for inline event handlers
window.UI = UI;
