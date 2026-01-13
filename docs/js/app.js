/**
 * M2B PWA - Main Application Coordinator
 * Coordinates all modules and provides UI facade
 * Dependencies: All modules
 */

// UI Controller - Facade for all UI operations
class UI {
    static async init() {
        // Display mode detection for debugging PWA standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        console.log('PWA Display mode:', isStandalone ? 'standalone' : 'browser');
        if (!isStandalone) {
            console.warn('⚠️ PWA is not running in standalone mode. Address bar may be visible.');
            console.log('💡 To fix: Remove PWA from home screen, clear cache, and reinstall.');
        } else {
            console.log('✅ PWA running in standalone mode - address bar should be hidden');
        }

        Navigation.setupNavigation();
        VoiceCapture.setupCapture();
        this.setupSettings();
        this.setupOnlineStatus();
        this.setupTaskTabs();
        this.setupProjectTabs();
        Navigation.setupMoreMenu();
        this.setupActionButtons();
        this.disableBrowserContextMenu();

        // Initialize local storage and perform migration
        if (AppState.token) {
            try {
                await SyncManager.performMigration();
                await this.updateSyncBadge();

                // Background sync (non-blocking)
                SyncManager.backgroundSync();
            } catch (error) {
                console.error('Error during migration:', error);
                this.showToast('Failed to initialize local storage. Check console for details.', 'error');
            }
        }

        // Load data if token exists
        if (AppState.token) {
            // Render the current view from local storage immediately.
            if (window.Viewer && Viewer.isView(AppState.currentView)) {
                await Viewer.load(AppState.currentView);
            }

            // Note: syncData is not awaited to avoid blocking the UI
            this.syncData();
        } else {
            this.showSettings();
        }

        QueueManager.loadQueue();
        this.updateQueueDisplay();
    }

    static setupTaskTabs() {
        // No longer needed - removed personal/work context tabs
    }

    static setupProjectTabs() {
        // Tabs removed - projects view simplified
    }

    static disableBrowserContextMenu() {
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
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

        const forceResyncBtn = document.getElementById('forceResyncBtn');
        if (forceResyncBtn) {
            forceResyncBtn.addEventListener('click', async () => {
                if (confirm('This will re-download all files from GitHub, overwriting any local changes. Continue?')) {
                    try {
                        forceResyncBtn.disabled = true;
                        forceResyncBtn.textContent = 'Syncing...';

                        await LocalStorageManager.clearAll();
                        await SyncManager.loadAllFromGitHub();

                        this.showToast('Re-sync complete', 'success');
                        await this.updateSyncBadge();
                        this.updateStorageStatus();

                        // Reload current view
                        if (window.Viewer && Viewer.isView(AppState.currentView)) {
                            await Viewer.load(AppState.currentView);
                        }
                    } catch (error) {
                        this.showToast('Re-sync failed: ' + error.message, 'error');
                    } finally {
                        forceResyncBtn.disabled = false;
                        forceResyncBtn.textContent = 'Force Re-sync from GitHub';
                    }
                }
            });
        }
        const forceReloadBtn = document.getElementById('forceReloadBtn');
        if (forceReloadBtn) {
            forceReloadBtn.addEventListener('click', async () => {
                forceReloadBtn.disabled = true;
                forceReloadBtn.textContent = 'Reloading...';

                try {
                    if (navigator.serviceWorker) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(registrations.map(registration => registration.update()));
                    }
                } catch (error) {
                    this.showToast('Reload failed: ' + error.message, 'error');
                }

                const url = new URL(window.location.href);
                url.searchParams.set('reload', Date.now().toString());
                window.location.replace(url.toString());
            });
        }
    }

    static showSettings() {
        document.getElementById('githubToken').value = AppState.token;
        document.getElementById('githubRepo').value = AppState.repo;
        this.updateSyncStatus();
        this.updateStorageStatus();
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    static async updateStorageStatus() {
        const storageStatusEl = document.getElementById('storageStatus');
        if (!storageStatusEl) return;

        try {
            const counts = await LocalStorageManager.getStatusCounts();
            storageStatusEl.textContent = `${counts.total} files (${counts.dirty} pending sync, ${counts.conflicts} conflicts)`;
        } catch (error) {
            storageStatusEl.textContent = 'Error loading status';
        }
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

    static setupActionButtons() {
        // Sync button
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncData());
        }

        // Generic "Add to" button handler
        const addButtonConfigs = [
            { id: 'addShoppingBtn', text: 'Add to Shopping ' },
            { id: 'addNotesBtn', text: 'Add to Notes ' },
            { id: 'addProjectsBtn', text: 'Add to Projects ' },
            { id: 'addTasksBtn', text: 'Add to Tasks ' }
        ];

        addButtonConfigs.forEach(config => {
            const btn = document.getElementById(config.id);
            if (btn) {
                btn.addEventListener('click', () => this.handleAddButton(config.text));
            }
        });
    }

    static handleAddButton(prefillText) {
        Navigation.switchView('capture');
        const captureInput = document.getElementById('captureInput');
        if (captureInput) {
            captureInput.value = prefillText;
            captureInput.focus();
            captureInput.setSelectionRange(prefillText.length, prefillText.length);
        }
    }

    static async syncData() {
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.classList.add('syncing');

        try {
            // Process offline queue for captures only
            await QueueManager.processQueue();

            // Sync dirty files using SyncManager
            const result = await SyncManager.syncAll();

            // Pull remote updates without overwriting local changes
            const pullResult = await SyncManager.pullLatestFromGitHub();

            // Update sync badge
            await this.updateSyncBadge();

            // Reload current view if files were synced
            if (result.synced > 0 || result.conflicts > 0 || pullResult.added > 0 || pullResult.updated > 0) {
                if (window.Viewer && Viewer.isView(AppState.currentView)) {
                    await Viewer.load(AppState.currentView);
                }
            }

            this.updateSyncStatus();
        } catch (error) {
            this.showToast('Sync failed: ' + error.message, 'error');
        } finally {
            syncBtn.classList.remove('syncing');
        }
    }

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

    static async showConflictModal(conflicts) {
        const modal = document.getElementById('conflictModal');
        const conflictList = document.getElementById('conflictList');

        if (!conflicts || conflicts.length === 0) {
            return;
        }

        let html = '';
        conflicts.forEach((conflict, index) => {
            const fileName = conflict.path.split('/').pop();
            const localDate = conflict.localModified ? new Date(conflict.localModified).toLocaleString() : 'Unknown';

            html += `
                <div class="conflict-item" data-conflict-index="${index}">
                    <div class="conflict-item-header">
                        <svg class="icon conflict-icon" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </svg>
                        <span>${fileName}</span>
                    </div>
                    <div class="conflict-item-details">
                        <div><strong>File:</strong> ${conflict.path}</div>
                        <div><strong>Local last modified:</strong> ${localDate}</div>
                        <div><strong>Status:</strong> Both local and remote versions have changed</div>
                    </div>
                    <div class="conflict-item-actions">
                        <button class="btn btn-secondary" onclick="UI.resolveConflictChoice('${conflict.path}', 'use-remote', ${index})">
                            Use Remote
                        </button>
                        <button class="btn btn-primary" onclick="UI.resolveConflictChoice('${conflict.path}', 'keep-local', ${index})">
                            Keep Local
                        </button>
                    </div>
                </div>
            `;
        });

        conflictList.innerHTML = html;
        modal.classList.remove('hidden');
    }

    static closeConflictModal() {
        const modal = document.getElementById('conflictModal');
        modal.classList.add('hidden');
    }

    static async resolveConflictChoice(path, resolution, conflictIndex) {
        try {
            // Show loading state
            const conflictItem = document.querySelector(`[data-conflict-index="${conflictIndex}"]`);
            if (conflictItem) {
                conflictItem.style.opacity = '0.5';
                conflictItem.style.pointerEvents = 'none';
            }

            // Resolve the conflict
            await SyncManager.resolveConflict(path, resolution);

            // Remove from UI
            if (conflictItem) {
                conflictItem.remove();
            }

            // Check if all conflicts are resolved
            const remainingConflicts = document.querySelectorAll('.conflict-item');
            if (remainingConflicts.length === 0) {
                this.closeConflictModal();
                this.showToast('All conflicts resolved!', 'success');
            }

            // Update sync badge
            await this.updateSyncBadge();

            // Reload current view
            if (window.Viewer && Viewer.isView(AppState.currentView)) {
                await Viewer.load(AppState.currentView);
            }
        } catch (error) {
            this.showToast('Failed to resolve conflict: ' + error.message, 'error');

            // Restore UI state
            const conflictItem = document.querySelector(`[data-conflict-index="${conflictIndex}"]`);
            if (conflictItem) {
                conflictItem.style.opacity = '1';
                conflictItem.style.pointerEvents = 'auto';
            }
        }
    }

    static async updateSyncBadge() {
        const badge = document.getElementById('syncBadge');
        if (!badge) return;

        try {
            const status = await SyncManager.getSyncStatus();
            const count = status.dirty + status.conflicts;

            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');

                if (status.conflicts > 0) {
                    badge.classList.add('has-conflicts');
                } else {
                    badge.classList.remove('has-conflicts');
                }
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('has-conflicts');
            }

            // Update AppState
            AppState.syncStatus = status;
        } catch (error) {
            console.error('Error updating sync badge:', error);
        }
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

    static showSuccessAndUpdateBadge(message) {
        this.showToast(message, 'success');
        this.updateSyncBadge();
    }

    static showInfoAndUpdateBadge(message) {
        this.showToast(message, 'info');
        this.updateSyncBadge();
    }

    static showErrorAndRerender(message, viewName) {
        this.showToast(message, 'error');
        if (viewName && window.ViewRenderer) {
            ViewRenderer.render(viewName);
        }
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
