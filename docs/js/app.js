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
                UI.showToast(`Synced: ${action.description}`, 'success');
            } catch (error) {
                // Re-queue failed actions
                AppState.queue.push(action);
                UI.showToast(`Sync failed: ${action.description}`, 'error');
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
        this.setupMoreMenu();

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
        const holdToTalkBtn = document.getElementById('holdToTalkBtn');

        const holdIconMarkup = `
            <svg class="icon icon-mic" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
        `;

        const buildHoldButtonMarkup = (label, showSpinner = false) => `
            <span class="btn-icon">${showSpinner ? '<span class="spinner"></span>' : holdIconMarkup}</span>
            ${label}
        `;

        const setHoldButtonState = (state) => {
            if (!holdToTalkBtn) return;
            if (state === 'recording') {
                holdToTalkBtn.classList.add('recording');
                holdToTalkBtn.disabled = false;
                holdToTalkBtn.setAttribute('aria-pressed', 'true');
                holdToTalkBtn.innerHTML = buildHoldButtonMarkup('Release to transcribe');
                return;
            }
            if (state === 'transcribing') {
                holdToTalkBtn.classList.remove('recording');
                holdToTalkBtn.disabled = true;
                holdToTalkBtn.setAttribute('aria-pressed', 'false');
                holdToTalkBtn.innerHTML = buildHoldButtonMarkup('Transcribing...', true);
                return;
            }

            holdToTalkBtn.classList.remove('recording');
            holdToTalkBtn.disabled = false;
            holdToTalkBtn.setAttribute('aria-pressed', 'false');
            holdToTalkBtn.innerHTML = buildHoldButtonMarkup('Hold to talk');
        };

        let mediaRecorder = null;
        let recordingStream = null;
        let audioChunks = [];
        let isRecording = false;
        let isTranscribing = false;
        let transcriberPromise = null;

        const supportsVoiceCapture = !!(holdToTalkBtn && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

        const stopStream = () => {
            if (recordingStream) {
                recordingStream.getTracks().forEach(track => track.stop());
                recordingStream = null;
            }
        };

        const loadTransformers = async () => {
            if (window.transformers?.pipeline) {
                return window.transformers;
            }
            try {
                const module = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
                return module;
            } catch (error) {
                throw new Error('Failed to load speech transcription library.');
            }
        };

        const getTranscriber = async () => {
            if (transcriberPromise) {
                return transcriberPromise;
            }
            transcriberPromise = (async () => {
                const { pipeline, env } = await loadTransformers();
                env.allowLocalModels = false;
                env.useBrowserCache = true;
                env.logLevel = 'fatal'; // Suppress ONNX Runtime warnings
                return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
            })();
            return transcriberPromise;
        };

        const appendTranscript = (transcript) => {
            if (!transcript) return;
            const trimmed = transcript.trim();
            if (!trimmed) return;
            captureInput.value = captureInput.value.trim()
                ? `${captureInput.value.trim()}\n${trimmed}`
                : trimmed;
            captureInput.focus();
        };

        const transcribeAudioBlob = async (blob) => {
            if (!blob || blob.size === 0) {
                UI.showToast('No audio captured', 'info');
                return;
            }
            isTranscribing = true;
            setHoldButtonState('transcribing');
            try {
                const transcriber = await getTranscriber();
                const audioUrl = URL.createObjectURL(blob);
                const result = await transcriber(audioUrl);
                URL.revokeObjectURL(audioUrl);
                const transcript = result?.text || '';
                if (!transcript.trim()) {
                    UI.showToast('No speech detected', 'info');
                    return;
                }
                appendTranscript(transcript);
                UI.showToast('Voice note transcribed', 'success');
            } catch (error) {
                transcriberPromise = null;
                UI.showToast(`Transcription failed: ${error.message}`, 'error');
            } finally {
                isTranscribing = false;
                setHoldButtonState('idle');
            }
        };

        const startRecording = async () => {
            if (!supportsVoiceCapture || isRecording || isTranscribing) return;
            try {
                recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioChunks = [];
                mediaRecorder = new MediaRecorder(recordingStream);
                mediaRecorder.addEventListener('dataavailable', (event) => {
                    if (event.data && event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                });
                mediaRecorder.addEventListener('stop', async () => {
                    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                    stopStream();
                    await transcribeAudioBlob(blob);
                });
                mediaRecorder.start();
                isRecording = true;
                setHoldButtonState('recording');
            } catch (error) {
                stopStream();
                isRecording = false;
                setHoldButtonState('idle');
                UI.showToast(`Microphone error: ${error.message}`, 'error');
            }
        };

        const stopRecording = () => {
            if (!isRecording) return;
            isRecording = false;
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                return;
            }
            stopStream();
            setHoldButtonState('idle');
        };

        if (holdToTalkBtn) {
            if (!supportsVoiceCapture) {
                holdToTalkBtn.disabled = true;
                holdToTalkBtn.title = 'Voice capture not supported in this browser.';
            } else {
                setHoldButtonState('idle');
                holdToTalkBtn.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    if (event.pointerId) {
                        holdToTalkBtn.setPointerCapture?.(event.pointerId);
                    }
                    startRecording();
                });
                holdToTalkBtn.addEventListener('pointerup', (event) => {
                    event.preventDefault();
                    stopRecording();
                });
                holdToTalkBtn.addEventListener('pointerleave', (event) => {
                    event.preventDefault();
                    stopRecording();
                });
                holdToTalkBtn.addEventListener('pointercancel', (event) => {
                    event.preventDefault();
                    stopRecording();
                });
                holdToTalkBtn.addEventListener('keydown', (event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        startRecording();
                    }
                });
                holdToTalkBtn.addEventListener('keyup', (event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        stopRecording();
                    }
                });
            }
        }

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
                    this.showToast('Captured! Processing...', 'success');
                } else {
                    await QueueManager.enqueue({
                        type: 'capture',
                        data: { title, body },
                        description: text.substring(0, 50) + '...'
                    });
                    this.showToast('Queued for sync', 'info');
                }

                captureInput.value = '';
            } catch (error) {
                this.showToast('Capture failed: ' + error.message, 'error');
            } finally {
                captureBtn.disabled = false;
                captureBtn.innerHTML = `
                    <span class="btn-icon">
                        <svg class="icon icon-inbox" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                    </span>
                    Capture
                `;
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

            this.showToast('Settings saved', 'success');
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
                this.showToast('Connection successful!', 'success');
            } catch (error) {
                this.showToast('Connection failed: ' + error.message, 'error');
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
                this.showToast('Cache cleared', 'success');
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

    static setupMoreMenu() {
        document.querySelectorAll('.menu-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleMoreAction(action);
            });
        });
    }

    static handleMoreAction(action) {
        switch (action) {
            case 'files':
                this.showFileViewer();
                break;
            case 'digest':
                this.showToast('Daily Digest: Run /m2b-digest in Claude Code CLI', 'info');
                break;
            case 'review':
                this.showToast('Weekly Review: Run /m2b-review in Claude Code CLI', 'info');
                break;
            case 'fix':
                this.showToast('Fix Classifications: Run /m2b-fix in Claude Code CLI', 'info');
                break;
            case 'projects':
                this.showToast('Projects view coming soon', 'info');
                break;
            case 'people':
                this.showToast('People view coming soon', 'info');
                break;
            case 'search':
                this.showToast('Search coming soon', 'info');
                break;
            case 'inbox':
                this.showInboxLog();
                break;
        }
    }

    static async showFileViewer() {
        const modal = document.getElementById('fileViewerModal');
        modal.classList.remove('hidden');
        await this.loadFileTree();
    }

    static closeFileViewer() {
        document.getElementById('fileViewerModal').classList.add('hidden');
        document.getElementById('fileContent').classList.add('hidden');
        document.getElementById('fileTree').classList.remove('hidden');
    }

    static closeFileContent() {
        document.getElementById('fileContent').classList.add('hidden');
        document.getElementById('fileTree').classList.remove('hidden');
    }

    static async loadFileTree() {
        const fileTree = document.getElementById('fileTree');
        fileTree.innerHTML = '<div class="loading">Loading files...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Define directory structure
            const structure = [
                { path: 'md/admin/personal', label: 'Admin - Personal' },
                { path: 'md/admin/work', label: 'Admin - Work' },
                { path: 'md/projects/personal/active', label: 'Projects - Personal - Active' },
                { path: 'md/projects/personal/waiting', label: 'Projects - Personal - Waiting' },
                { path: 'md/projects/personal/blocked', label: 'Projects - Personal - Blocked' },
                { path: 'md/projects/personal/done', label: 'Projects - Personal - Done' },
                { path: 'md/projects/work/active', label: 'Projects - Work - Active' },
                { path: 'md/projects/work/waiting', label: 'Projects - Work - Waiting' },
                { path: 'md/projects/work/blocked', label: 'Projects - Work - Blocked' },
                { path: 'md/projects/work/done', label: 'Projects - Work - Done' },
                { path: 'md/ideas', label: 'Ideas' },
                { path: 'md/people', label: 'People' },
                { path: 'md/inbox', label: 'Inbox' },
                { path: 'md', label: 'Other Files', root: true }
            ];

            // Fetch all directories in parallel
            const fetchPromises = structure.map(async dir => {
                try {
                    const contents = await api.request(`/contents/${dir.path}`);
                    let files;
                    if (dir.root) {
                        // Get root level files only
                        files = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));
                    } else {
                        files = contents.filter(item => item.type === 'file');
                    }
                    return { ...dir, files };
                } catch (e) {
                    // Directory doesn't exist or is inaccessible, return empty
                    return { ...dir, files: [] };
                }
            });

            const results = await Promise.all(fetchPromises);

            let html = '<div class="file-tree-list">';

            results.forEach(dir => {
                if (dir.files.length > 0) {
                    html += `<div class="file-tree-folder">`;
                    html += `<div class="file-tree-folder-name">${dir.label}</div>`;
                    html += `<ul class="file-tree-items">`;

                    dir.files.forEach(file => {
                        html += `
                            <li class="file-tree-item" onclick="UI.viewFile('${file.path}', '${file.name}')">
                                <svg class="icon icon-file" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                ${file.name}
                            </li>
                        `;
                    });

                    html += `</ul></div>`;
                }
            });

            html += '</div>';
            fileTree.innerHTML = html;
        } catch (error) {
            fileTree.innerHTML = `<div class="error">Error loading files: ${error.message}</div>`;
        }
    }

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

            // Convert markdown to HTML (basic conversion)
            const htmlContent = this.markdownToHtml(content);
            fileContentBody.innerHTML = htmlContent;
        } catch (error) {
            fileContentBody.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
        }
    }

    static markdownToHtml(markdown) {
        // Basic markdown to HTML conversion
        let html = markdown;

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

        // Checkboxes
        html = html.replace(/- \[ \] (.*$)/gim, '<div class="checkbox-item"><input type="checkbox" disabled> $1</div>');
        html = html.replace(/- \[x\] (.*$)/gim, '<div class="checkbox-item"><input type="checkbox" checked disabled> $1</div>');

        // Lists
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');

        // Line breaks
        html = html.replace(/\n/gim, '<br>');

        return html;
    }

    static async showInboxLog() {
        this.showToast('Loading inbox log...', 'info');
        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const content = await api.getFile('md/inbox/inbox-log.md');

            // Show in file viewer
            this.showFileViewer();
            document.getElementById('fileTree').classList.add('hidden');
            document.getElementById('fileContent').classList.remove('hidden');
            document.getElementById('fileTitle').textContent = 'inbox-log.md';
            document.getElementById('fileContentBody').innerHTML = this.markdownToHtml(content);
        } catch (error) {
            this.showToast('Error loading inbox log: ' + error.message, 'error');
        }
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
            this.showToast('Synced', 'success');
        } catch (error) {
            this.showToast('Sync failed: ' + error.message, 'error');
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
                this.showToast('Updated', 'success');
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
                this.showToast('Queued for sync', 'info');
            }
        } catch (error) {
            this.showToast('Update failed: ' + error.message, 'error');
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

        let html = `
            <div class="section">
                <h3>
                    <svg class="icon icon-flame" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                    </svg>
                    Urgent (Due within 7 days)
                </h3>
                <div class="checklist">
        `;

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

        html += `
            <div class="section">
                <h3>
                    <svg class="icon icon-calendar" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <path d="M3 10h18" />
                    </svg>
                    Longer Term
                </h3>
                <div class="checklist">
        `;

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
                <span class="queue-icon">
                    <svg class="icon icon-clock" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 6v6l4 2" />
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                </span>
                <span class="queue-text">${item.description}</span>
            </div>
        `).join('');
    }

    static showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const icons = {
            success: `
                <svg class="icon icon-check" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            `,
            error: `
                <svg class="icon icon-x" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
            `,
            info: `
                <svg class="icon icon-info" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                </svg>
            `
        };
        const iconMarkup = icons[type] || icons.info;

        toast.textContent = '';
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'toast-icon';
        iconWrapper.innerHTML = iconMarkup;
        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        toast.append(iconWrapper, textSpan);
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
