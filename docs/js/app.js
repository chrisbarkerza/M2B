/**
 * M2B PWA - Second Brain Application
 */

// App State
const AppState = {
    token: localStorage.getItem('github_token') || '',
    repo: localStorage.getItem('github_repo') || 'chrisbarkerza/M2B-Data',
    issuesRepo: 'chrisbarkerza/M2B', // Issues go to public M2B repo, data comes from M2B-Data
    isOnline: navigator.onLine,
    currentView: 'capture',
    data: {
        shopping: null,
        todo: null,
        projects: [],
        notes: []
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

    async request(endpoint, method = 'GET', body = null, silent = false) {
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
            if (silent && response.status === 404) {
                return null;
            }
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

    async getIssueComments(issueNumber) {
        return this.request(`/issues/${issueNumber}/comments`);
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
        const sections = { Supplements: [], Pharmacy: [], Food: [] };
        let currentSection = null;

        content.split('\n').forEach(line => {
            const sectionMatch = line.match(/^## (.+)$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                if (!sections[currentSection]) {
                    sections[currentSection] = [];
                }
                return;
            }

            const itemMatch = line.match(/^- \[([ x])\] (.+)$/);
            if (itemMatch && currentSection) {
                sections[currentSection].push({
                    checked: itemMatch[1] === 'x',
                    text: itemMatch[2]
                });
            }
        });

        return { sections };
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
                const priorityMatch = taskMatch[3].match(/\[priority: (\w+)\]/);
                const orderMatch = taskMatch[3].match(/\[order: (\d+)\]/);
                const projectMatch = taskMatch[3].match(/\[project: ([^\]]+)\]/);

                tasks[currentSection].push({
                    checked: taskMatch[1] === 'x',
                    text: taskMatch[2],
                    due: dueMatch ? dueMatch[1] : null,
                    confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : null,
                    priority: priorityMatch ? priorityMatch[1] : 'medium',
                    order: orderMatch ? parseInt(orderMatch[1]) : 999,
                    project: projectMatch ? projectMatch[1] : null,
                    raw: line
                });
            }
        });

        return { frontmatter, tasks };
    }

    // serializeShoppingList removed - no frontmatter needed
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

        const queue = [...AppState.queue];
        AppState.queue = [];

        for (const action of queue) {
            try {
                if (action.type === 'capture') {
                    // Use issuesRepo for captures
                    const issuesApi = new GitHubAPI(AppState.token, AppState.issuesRepo);
                    await issuesApi.createIssue(action.data.title, action.data.body);
                } else if (action.type === 'update_file') {
                    // Use data repo for file updates
                    const dataApi = new GitHubAPI(AppState.token, AppState.repo);
                    await dataApi.updateFile(action.data.path, action.data.content, action.data.message);
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
        this.setupProjectTabs();
        this.setupMoreMenu();
        this.setupActionButtons();

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
        } else if (viewName === 'tasks' && !AppState.data.todo) {
            this.loadTasks();
        } else if (viewName === 'notes') {
            this.loadNotes();
        } else if (viewName === 'projects') {
            this.loadProjects();
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

            // Hide result from previous capture
            const resultDiv = document.getElementById('captureResult');
            resultDiv?.classList.add('hidden');

            try {
                const lines = text.split('\n');
                const title = lines[0].trim().slice(0, 80) || 'Capture';
                const body = lines.slice(1).join('\n').trim() || text;

                if (AppState.isOnline && AppState.token) {
                    // Use issuesRepo for creating issues (M2B), not the data repo (M2B-Data)
                    const issuesApi = new GitHubAPI(AppState.token, AppState.issuesRepo);
                    const issue = await issuesApi.createIssue(title, body);
                    this.showToast('Captured! Processing...', 'success');

                    // Clear input immediately
                    captureInput.value = '';

                    // Poll for result
                    this.pollForCaptureResult(issuesApi, issue.number, resultDiv);
                } else {
                    await QueueManager.enqueue({
                        type: 'capture',
                        data: { title, body },
                        description: text.substring(0, 50) + '...'
                    });
                    this.showToast('Queued for sync', 'info');
                    captureInput.value = '';
                }
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

        document.getElementById('forceSyncBtn').addEventListener('click', async () => {
            const syncBtn = document.getElementById('forceSyncBtn');
            const originalText = syncBtn.textContent;
            syncBtn.disabled = true;
            syncBtn.textContent = 'Syncing...';

            try {
                await QueueManager.processQueue();
                localStorage.setItem('last_sync', new Date().toISOString());
                this.updateSyncStatus();
                this.showToast('Sync completed', 'success');
            } catch (error) {
                this.showToast('Sync failed: ' + error.message, 'error');
            } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = originalText;
            }
        });

        document.getElementById('clearCacheBtn').addEventListener('click', () => {
            if (confirm('Clear all cached data?')) {
                AppState.data = {
                    shopping: null,
                    todo: null,
                    projects: [],
                    notes: []
                };
                this.showToast('Cache cleared', 'success');
            }
        });
    }

    static showSettings() {
        document.getElementById('githubToken').value = AppState.token;
        document.getElementById('githubRepo').value = AppState.repo;
        this.updateSyncStatus();
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    static updateSyncStatus() {
        const lastSync = localStorage.getItem('last_sync');
        const lastSyncEl = document.getElementById('lastSync');

        if (lastSync) {
            const date = new Date(lastSync);
            lastSyncEl.textContent = date.toLocaleString();
        } else {
            lastSyncEl.textContent = 'Never';
        }

        const queueCount = AppState.queue.length;
        const queueStatus = document.getElementById('queueStatus');
        const queueCountEl = document.getElementById('queueCount');

        if (queueCount > 0) {
            queueCountEl.textContent = queueCount;
            queueStatus.style.display = 'block';
        } else {
            queueStatus.style.display = 'none';
        }
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
        // No longer needed - removed personal/work context tabs
    }

    static setupProjectTabs() {
        // Tabs removed - projects view simplified
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
            case 'tasks':
                this.switchView('tasks');
                break;
            case 'files':
                this.showFileViewer();
                break;
            case 'digest':
                this.showDigest();
                break;
            case 'search':
                this.showSearch();
                break;
            case 'inbox':
                this.showInboxLog();
                break;
        }
    }

    static setupActionButtons() {
        // Clear Completed button for shopping list (currently unused since items auto-move)
        const clearCompletedBtn = document.getElementById('clearCompletedBtn');
        if (clearCompletedBtn) {
            clearCompletedBtn.addEventListener('click', async () => {
                // Since items are now moved immediately on check, this button is less relevant
                // But we can use it to clear all checked items at once
                await this.clearCompletedShopping();
            });
        }

        // Archive Completed button for tasks
        const archiveCompletedBtn = document.getElementById('archiveCompletedBtn');
        if (archiveCompletedBtn) {
            archiveCompletedBtn.addEventListener('click', async () => {
                await this.archiveCompletedTasks();
            });
        }

        // Sync button
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                this.syncData();
            });
        }

        // Add to Shopping button
        const addShoppingBtn = document.getElementById('addShoppingBtn');
        if (addShoppingBtn) {
            addShoppingBtn.addEventListener('click', () => {
                this.switchView('capture');
                const captureInput = document.getElementById('captureInput');
                if (captureInput) {
                    captureInput.value = 'Add to Shopping ';
                    captureInput.focus();
                    // Position cursor at end
                    captureInput.setSelectionRange(captureInput.value.length, captureInput.value.length);
                }
            });
        }

        // Add to Notes button
        const addNotesBtn = document.getElementById('addNotesBtn');
        if (addNotesBtn) {
            addNotesBtn.addEventListener('click', () => {
                this.switchView('capture');
                const captureInput = document.getElementById('captureInput');
                if (captureInput) {
                    captureInput.value = 'Add to Notes ';
                    captureInput.focus();
                    captureInput.setSelectionRange(captureInput.value.length, captureInput.value.length);
                }
            });
        }

        // Add to Projects button
        const addProjectsBtn = document.getElementById('addProjectsBtn');
        if (addProjectsBtn) {
            addProjectsBtn.addEventListener('click', () => {
                this.switchView('capture');
                const captureInput = document.getElementById('captureInput');
                if (captureInput) {
                    captureInput.value = 'Add to Projects ';
                    captureInput.focus();
                    captureInput.setSelectionRange(captureInput.value.length, captureInput.value.length);
                }
            });
        }
    }

    static async clearCompletedShopping() {
        // This is now mostly a no-op since items are moved on check
        // But we'll keep it for clearing any remaining checked items
        let hasChecked = false;
        Object.values(AppState.data.shopping.sections).forEach(items => {
            if (items.some(item => item.checked)) {
                hasChecked = true;
            }
        });

        if (!hasChecked) {
            this.showToast('No completed items to clear', 'info');
            return;
        }

        // Move all checked items to done
        for (const [section, items] of Object.entries(AppState.data.shopping.sections)) {
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].checked) {
                    await this.moveShoppingItemToDone(section, i);
                }
            }
        }
    }

    static async archiveCompletedTasks() {
        // Get all checked tasks
        const checkedTasks = [];
        const checkboxes = document.querySelectorAll('#tasksContent input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            this.showToast('No completed tasks to archive', 'info');
            return;
        }

        checkboxes.forEach(checkbox => {
            const section = checkbox.dataset.section;
            const index = parseInt(checkbox.dataset.index);
            const taskText = checkbox.parentElement.querySelector('.checklist-text').textContent;
            checkedTasks.push({ section, index, text: taskText });
        });

        // Move to Done.md
        const today = new Date().toISOString().split('T')[0];

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Get current Done.md content for tasks
            let doneContent = '';
            try {
                doneContent = await api.getFile('md/ToDo/Done.md');
            } catch (error) {
                // File might not exist, create it
                doneContent = '# Tasks - Completed\n\n<!-- Completed tasks moved here with completion dates -->\n\n';
            }

            // Add completed tasks with date
            checkedTasks.forEach(task => {
                doneContent += `- [x] ${task.text} _(${today})_\n`;
            });

            // Remove from todo lists (in reverse order to maintain indices)
            checkedTasks.sort((a, b) => b.index - a.index).forEach(task => {
                AppState.data.todo[task.section].splice(task.index, 1);
            });

            // Serialize ToDo.md
            let todoContent = '# To-Do\n\n';
            todoContent += '## Today\n';
            AppState.data.todo.today.forEach(task => {
                todoContent += `- [ ] ${task}\n`;
            });
            todoContent += '\n## Soon\n';
            AppState.data.todo.soon.forEach(task => {
                todoContent += `- [ ] ${task}\n`;
            });
            todoContent += '\n## Long term\n';
            AppState.data.todo.longTerm.forEach(task => {
                todoContent += `- [ ] ${task}\n`;
            });

            if (AppState.isOnline) {
                // Update both files
                await api.updateFile('md/ToDo/Done.md', doneContent, `Archive ${checkedTasks.length} completed task(s)`);
                await api.updateFile('md/ToDo/ToDo.md', todoContent, `Remove ${checkedTasks.length} completed task(s)`);
                this.showToast(`Archived ${checkedTasks.length} task(s)`, 'success');
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/ToDo/Done.md',
                        content: doneContent,
                        message: `Archive completed tasks (offline)`
                    },
                    description: 'Task archive update'
                });
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/ToDo/ToDo.md',
                        content: todoContent,
                        message: `Remove completed tasks (offline)`
                    },
                    description: 'ToDo list update'
                });
                this.showToast('Queued for sync', 'info');
            }

            // Re-render tasks
            this.renderTasks();
        } catch (error) {
            this.showToast('Archive failed: ' + error.message, 'error');
        }
    }

    static async loadNotes() {
        await this.loadAccordionView('notesContent', 'md/Notes', 'notes');
    }

    static async viewFileInline(path, filename) {
        const content = document.getElementById('notesContent');
        content.innerHTML = '<div class="loading">Loading file...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const fileContent = await api.getFile(path);

            // Parse markdown to HTML (simple conversion)
            const html = this.markdownToHtml(fileContent);

            content.innerHTML = `
                <div class="file-content">
                    <div class="file-content-header">
                        <button class="btn btn-small" onclick="UI.loadNotes()">
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

    static async showDigest() {
        const modal = document.getElementById('digestModal');
        modal.classList.remove('hidden');
        await this.loadDigest();
    }

    static closeDigest() {
        document.getElementById('digestModal').classList.add('hidden');
    }

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

    static async viewFileInModal(path, filename) {
        // Open file viewer modal and load file
        const modal = document.getElementById('fileViewerModal');
        modal.classList.remove('hidden');

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
            const content = await api.getFile('md/inbox-log.md');

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

    static async showProjects() {
        const modal = document.getElementById('projectsModal');
        modal.classList.remove('hidden');

        // Set up tab switching
        const tabs = modal.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const status = tab.dataset.status;
                this.loadProjects(status);
            });
        });

        await this.loadProjects('active');
    }

    static closeProjects() {
        document.getElementById('projectsModal').classList.add('hidden');
    }

    static async loadProjects() {
        await this.loadAccordionView('projectsContent', 'md/Projects', 'projects');
    }

    // People feature removed

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

    static closeSearch() {
        document.getElementById('searchModal').classList.add('hidden');
    }

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
                'md/Notes'
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
                    <div class="search-result-item" onclick="UI.closeSearch(); UI.viewFileInModal('${file.path}', '${file.name}')">
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

    static async syncData() {
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.classList.add('syncing');

        try {
            await QueueManager.processQueue();
            // Clear cached data to force reload
            AppState.data.shopping = null;
            AppState.data.todo = null;

            // Reload current view
            if (AppState.currentView === 'shopping') {
                await this.loadShopping();
            } else if (AppState.currentView === 'tasks') {
                await this.loadTasks();
            }

            localStorage.setItem('last_sync', new Date().toISOString());
            this.updateSyncStatus();
            this.showToast('Synced', 'success');
        } catch (error) {
            this.showToast('Sync failed: ' + error.message, 'error');
        } finally {
            syncBtn.classList.remove('syncing');
        }
    }

    // Generic accordion loader for Shopping, Projects, Notes
    static async loadAccordionView(contentId, directory, viewType) {
        const content = document.getElementById(contentId);
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const contents = await api.request(`/contents/${directory}`, 'GET', null, true);

            if (!contents) {
                content.innerHTML = `<div class="empty-state">No files found</div>`;
                return;
            }

            // Filter .md files, exclude Done.md
            const files = contents.filter(item =>
                item.type === 'file' &&
                item.name.endsWith('.md') &&
                item.name !== 'Done.md' &&
                item.name !== 'Shopping.md' // Exclude old shopping file
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">No files found. <button class="btn btn-small" onclick="UI.showCreateFileDialog('${directory}', '${viewType}')">Create New</button></div>`;
                return;
            }

            // Load all files and parse checkboxes
            const filesData = await Promise.all(files.map(async file => {
                try {
                    const fileContent = await api.getFile(file.path);
                    const items = this.parseCheckboxItems(fileContent);
                    return {
                        name: file.name.replace('.md', ''),
                        path: file.path,
                        items: items,
                        expanded: false
                    };
                } catch (error) {
                    console.error(`Error loading ${file.name}:`, error);
                    return null;
                }
            }));

            const validFiles = filesData.filter(f => f !== null);

            // Store in AppState
            if (!AppState.data[viewType]) {
                AppState.data[viewType] = {};
            }
            AppState.data[viewType] = { directory, files: validFiles };

            this.renderAccordion(contentId, viewType);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    }

    static parseCheckboxItems(markdown) {
        const lines = markdown.split('\n');
        const items = [];

        lines.forEach(line => {
            const uncheckedMatch = line.match(/^- \[ \] (.+)$/);
            const checkedMatch = line.match(/^- \[x\] (.+)$/);

            if (uncheckedMatch) {
                items.push({ text: uncheckedMatch[1], checked: false });
            } else if (checkedMatch) {
                items.push({ text: checkedMatch[1], checked: true });
            }
        });

        return items;
    }

    static renderAccordion(contentId, viewType) {
        const content = document.getElementById(contentId);
        const data = AppState.data[viewType];

        if (!data || !data.files || data.files.length === 0) {
            content.innerHTML = `<div class="empty-state">No files found</div>`;
            return;
        }

        let html = '<div class="accordion">';
        html += `<button class="btn btn-small" onclick="UI.showCreateFileDialog('${data.directory}', '${viewType}')" style="margin-bottom: 8px;">+ New File</button>`;

        data.files.forEach((file, fileIndex) => {
            const expandedClass = file.expanded ? 'expanded' : '';
            const itemCount = file.items.filter(i => !i.checked).length;

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header" onclick="UI.toggleAccordion('${contentId}', '${viewType}', ${fileIndex})">`;
            html += `<span class="accordion-icon">▶</span>`;
            html += `<span>${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="checklist">`;

            file.items.forEach((item, itemIndex) => {
                if (!item.checked) {  // Only show unchecked items
                    html += `
                        <label class="checklist-item">
                            <input
                                type="checkbox"
                                data-view-type="${viewType}"
                                data-file-index="${fileIndex}"
                                data-item-index="${itemIndex}"
                                onchange="UI.toggleAccordionItem(this)"
                            >
                            <span class="checklist-text">${item.text}</span>
                        </label>
                    `;
                }
            });

            html += `</div></div></div>`;
        });

        html += '</div>';
        content.innerHTML = html;
    }

    static toggleAccordion(contentId, viewType, fileIndex) {
        const data = AppState.data[viewType];
        data.files[fileIndex].expanded = !data.files[fileIndex].expanded;
        this.renderAccordion(contentId, viewType);
    }

    static async toggleAccordionItem(checkbox) {
        const viewType = checkbox.dataset.viewType;
        const fileIndex = parseInt(checkbox.dataset.fileIndex);
        const itemIndex = parseInt(checkbox.dataset.itemIndex);

        const data = AppState.data[viewType];
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];

        // Mark as checked
        item.checked = true;

        // Move to Done.md
        await this.moveItemToDone(viewType, data.directory, file, item);

        // Re-render
        const contentId = viewType === 'shopping' ? 'shoppingContent' :
                         viewType === 'projects' ? 'projectsContent' : 'notesContent';
        this.renderAccordion(contentId, viewType);
    }

    static async moveItemToDone(viewType, directory, file, item) {
        const today = new Date().toISOString().split('T')[0];
        const api = new GitHubAPI(AppState.token, AppState.repo);

        try {
            // Get current Done.md
            let doneContent = '';
            const donePath = `${directory}/Done.md`;
            try {
                doneContent = await api.getFile(donePath);
            } catch (error) {
                doneContent = `# ${directory.split('/').pop()} - Completed\n\n<!-- Checked items moved here with completion dates -->\n\n`;
            }

            // Append with source file prefix and date
            doneContent += `- [x] [${file.name}] ${item.text} _(${today})_\n`;

            // Update source file (remove the item)
            const sourceContent = await api.getFile(file.path);
            const lines = sourceContent.split('\n');
            const newLines = lines.filter(line => {
                const match = line.match(/^- \[ \] (.+)$/);
                return !match || match[1] !== item.text;
            });
            const newSourceContent = newLines.join('\n');

            if (AppState.isOnline) {
                await api.updateFile(donePath, doneContent, `Archive: ${item.text}`);
                await api.updateFile(file.path, newSourceContent, `Remove completed: ${item.text}`);
                this.showToast('Moved to Done', 'success');
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: { path: donePath, content: doneContent, message: 'Archive item (offline)' },
                    description: 'Archive update'
                });
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: { path: file.path, content: newSourceContent, message: 'Remove item (offline)' },
                    description: 'File update'
                });
                this.showToast('Queued for sync', 'info');
            }

            // Remove from data
            file.items = file.items.filter(i => i !== item);
        } catch (error) {
            this.showToast('Failed to move item: ' + error.message, 'error');
            item.checked = false;  // Revert
        }
    }

    static showCreateFileDialog(directory, viewType) {
        const fileName = prompt('Enter file name (without .md):');
        if (!fileName) return;

        this.createNewFile(directory, fileName, viewType);
    }

    static async createNewFile(directory, fileName, viewType) {
        const api = new GitHubAPI(AppState.token, AppState.repo);
        const filePath = `${directory}/${fileName}.md`;
        const content = `# ${fileName}\n\n- [ ] First item\n`;

        try {
            if (AppState.isOnline) {
                await api.updateFile(filePath, content, `Create new file: ${fileName}`);
                this.showToast('File created', 'success');
                // Reload view
                const contentId = viewType === 'shopping' ? 'shoppingContent' :
                                 viewType === 'projects' ? 'projectsContent' : 'notesContent';
                await this.loadAccordionView(contentId, directory, viewType);
            } else {
                this.showToast('Cannot create files while offline', 'error');
            }
        } catch (error) {
            this.showToast('Failed to create file: ' + error.message, 'error');
        }
    }

    static async loadShopping() {
        await this.loadAccordionView('shoppingContent', 'md/Shopping', 'shopping');
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

        // If checked, move to done immediately
        if (checkbox.checked) {
            await this.moveShoppingItemToDone(section, index);
        } else {
            // If unchecked, just update the file
            await this.updateShoppingFile();
        }
    }

    static async moveShoppingItemToDone(section, index) {
        const item = AppState.data.shopping.sections[section][index];
        const today = new Date().toISOString().split('T')[0];

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);

            // Get current Done.md content
            let doneContent = '';
            try {
                doneContent = await api.getFile('md/Shopping/Done.md');
            } catch (error) {
                // File might not exist, create it
                doneContent = '# Shopping - Completed\n\n<!-- Checked items moved here with completion dates -->\n\n';
            }

            // Add the completed item with date
            doneContent += `- [x] ${item.text} _(${today})_\n`;

            // Remove from shopping list
            AppState.data.shopping.sections[section].splice(index, 1);

            // Serialize shopping list
            let shoppingContent = '# Shopping List\n';
            Object.entries(AppState.data.shopping.sections).forEach(([sectionName, items]) => {
                if (sectionName === 'Shopping List') return;
                shoppingContent += `\n## ${sectionName}\n`;
                items.forEach(item => {
                    const checkbox = item.checked ? '[x]' : '[ ]';
                    shoppingContent += `- ${checkbox} ${item.text}\n`;
                });
            });

            if (AppState.isOnline) {
                // Update both files
                await api.updateFile('md/Shopping/Done.md', doneContent, `Add completed item: ${item.text}`);
                await api.updateFile('md/Shopping/Shopping.md', shoppingContent, `Remove completed item: ${item.text}`);
                this.showToast('Moved to Done', 'success');
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/Shopping/Done.md',
                        content: doneContent,
                        message: `Add completed item (offline)`
                    },
                    description: 'Shopping done update'
                });
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/Shopping/Shopping.md',
                        content: shoppingContent,
                        message: `Remove completed item (offline)`
                    },
                    description: 'Shopping list update'
                });
                this.showToast('Queued for sync', 'info');
            }

            // Re-render the shopping list
            this.renderShopping();
        } catch (error) {
            this.showToast('Update failed: ' + error.message, 'error');
            // Revert the change
            AppState.data.shopping.sections[section][index].checked = false;
            this.renderShopping();
        }
    }

    static async updateShoppingFile() {
        // Serialize shopping list
        let newContent = '# Shopping List\n';
        Object.entries(AppState.data.shopping.sections).forEach(([sectionName, items]) => {
            if (sectionName === 'Shopping List') return;
            newContent += `\n## ${sectionName}\n`;
            items.forEach(item => {
                const checkbox = item.checked ? '[x]' : '[ ]';
                newContent += `- ${checkbox} ${item.text}\n`;
            });
        });

        try {
            if (AppState.isOnline) {
                const api = new GitHubAPI(AppState.token, AppState.repo);
                await api.updateFile('md/Shopping/Shopping.md', newContent, `Update shopping list`);
                this.showToast('Updated', 'success');
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: {
                        path: 'md/Shopping/Shopping.md',
                        content: newContent,
                        message: `Update shopping list (offline)`
                    },
                    description: 'Shopping list update'
                });
                this.showToast('Queued for sync', 'info');
            }
        } catch (error) {
            this.showToast('Update failed: ' + error.message, 'error');
        }
    }

    static async loadTasks() {
        const content = document.getElementById('tasksContent');
        content.innerHTML = '<div class="loading">Loading tasks...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const todoContent = await api.getFile('md/ToDo/ToDo.md');

            // Parse the ToDo.md file
            const tasks = { today: [], soon: [], longTerm: [] };
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
                    currentSection = 'longTerm';
                    return;
                }

                const taskMatch = line.match(/^- \[ \] (.+)$/);
                if (taskMatch && currentSection) {
                    tasks[currentSection].push(taskMatch[1]);
                }
            });

            AppState.data.todo = tasks;
            this.renderTasks();
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading tasks: ${error.message}</div>`;
        }
    }

    static renderTasks() {
        const content = document.getElementById('tasksContent');
        const { today, soon, longTerm } = AppState.data.todo;

        let html = `
            <div class="section">
                <h3>
                    <svg class="icon icon-flame" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                    </svg>
                    Today
                </h3>
                <div class="checklist">
        `;

        today.forEach((task, index) => {
            html += `
                <label class="checklist-item">
                    <input type="checkbox" data-section="today" data-index="${index}">
                    <span class="checklist-text">${task}</span>
                </label>
            `;
        });

        if (today.length === 0) {
            html += '<div class="empty-state">No tasks for today! 🎉</div>';
        }

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
                    Soon
                </h3>
                <div class="checklist">
        `;

        soon.forEach((task, index) => {
            html += `
                <label class="checklist-item">
                    <input type="checkbox" data-section="soon" data-index="${index}">
                    <span class="checklist-text">${task}</span>
                </label>
            `;
        });

        if (soon.length === 0) {
            html += '<div class="empty-state">No tasks coming up soon</div>';
        }

        html += '</div></div>';

        html += `
            <div class="section">
                <h3>Long Term</h3>
                <div class="checklist">
        `;

        longTerm.forEach((task, index) => {
            html += `
                <label class="checklist-item">
                    <input type="checkbox" data-section="longTerm" data-index="${index}">
                    <span class="checklist-text">${task}</span>
                </label>
            `;
        });

        if (longTerm.length === 0) {
            html += '<div class="empty-state">No long-term tasks</div>';
        }

        html += '</div></div>';

        content.innerHTML = html;
    }

    // Ideas feature removed

    static updateQueueDisplay() {
        const queueSection = document.getElementById('captureQueue');
        const queueList = document.getElementById('queueList');

        if (AppState.queue.length === 0) {
            queueSection.classList.add('hidden');
        } else {
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

        // Update settings queue status
        this.updateSyncStatus();
    }

    static async pollForCaptureResult(api, issueNumber, resultDiv) {
        const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
        let attempts = 0;

        const poll = async () => {
            attempts++;

            try {
                const comments = await api.getIssueComments(issueNumber);

                // Look for the bot comment with classification result
                const botComment = comments.find(comment =>
                    comment.user.login.includes('bot') ||
                    comment.user.login.includes('github-actions') ||
                    comment.body.includes('✓ **Capture processed successfully!**')
                );

                if (botComment) {
                    // Parse the result from the comment
                    const body = botComment.body;
                    const categoryMatch = body.match(/\*\*Classification:\*\* (\w+)/);
                    const confidenceMatch = body.match(/\*\*Confidence:\*\* (\d+)%/);
                    const locationMatch = body.match(/\*\*Location:\*\* `([^`]+)`/);

                    const category = categoryMatch ? categoryMatch[1] : 'unknown';
                    const confidence = confidenceMatch ? confidenceMatch[1] : '?';
                    const location = locationMatch ? locationMatch[1] : 'unknown';

                    // Show the result
                    this.displayCaptureResult(resultDiv, {
                        category,
                        confidence,
                        location
                    });

                    return; // Stop polling
                }

                // Continue polling if not found yet and under max attempts
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000); // Poll every 2 seconds
                } else {
                    // Timeout
                    this.showToast('Processing taking longer than expected...', 'info');
                }
            } catch (error) {
                console.error('Error polling for result:', error);
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000);
                }
            }
        };

        // Start polling
        setTimeout(poll, 2000); // Wait 2 seconds before first poll
    }

    static displayCaptureResult(resultDiv, result) {
        if (!resultDiv) return;

        const confidenceColor = result.confidence >= 75 ? 'success' : 'warning';
        const categoryIcons = {
            shopping: '🛒',
            todo_today: '🔥',
            todo_soon: '📅',
            todo_long_term: '📆',
            project: '📁',
            note: '📝'
        };

        const icon = categoryIcons[result.category] || '✓';

        const resultContent = resultDiv.querySelector('.result-content');
        resultContent.innerHTML = `
            <div class="result-header">
                <span class="result-icon">${icon}</span>
                <strong>Capture Classified!</strong>
            </div>
            <div class="result-details">
                <div class="result-row">
                    <span class="result-label">Type:</span>
                    <span class="result-value">${result.category.replace(/_/g, ' ')}</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Confidence:</span>
                    <span class="result-value result-${confidenceColor}">${result.confidence}%</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Saved to:</span>
                    <span class="result-value result-location">${result.location}</span>
                </div>
            </div>
        `;

        resultDiv.classList.remove('hidden');

        // Show success toast
        this.showToast(`Classified as ${result.category} (${result.confidence}% confidence)`, 'success');

        // Scroll result into view smoothly
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

function showTokenInstructions() {
    const instructions = document.getElementById('token-instructions');
    if (!instructions) return;
    instructions.classList.toggle('hidden');
}

// Expose UI methods globally for inline event handlers
window.UI = UI;
window.showTokenInstructions = showTokenInstructions;
