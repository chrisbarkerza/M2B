/**
 * Shared accordion viewer for list-based tabs.
 */
const Viewer = {
    gestureState: null,
    highlightMenu: null,
    highlightMenuJustOpened: false,
    config: {
        tasks: {
            directory: 'md/ToDo',
            contentId: 'tasksContent',
            emptyMessage: 'No files found'
        },
        projects: {
            directory: 'md/Projects',
            contentId: 'projectsContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        notes: {
            directory: 'md/Notes',
            contentId: 'notesContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        shopping: {
            directory: 'md/Shopping',
            contentId: 'shoppingContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        ideas: {
            directory: 'md/Ideas',
            contentId: 'ideasContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        },
        people: {
            directory: 'md/People',
            contentId: 'peopleContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        }
    },

    isView(viewName) {
        return Boolean(this.config[viewName]);
    },

    async load(viewName) {
        const config = this.config[viewName];
        if (!config) return;

        const content = document.getElementById(config.contentId);
        if (!content) return;
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const contents = await api.request(`/contents/${config.directory}`, 'GET', null, true);

            if (!contents) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            const files = contents.filter(item =>
                item.type === 'file' &&
                item.name.endsWith('.md') &&
                item.name !== 'Done.md'
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

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

            AppState.data[viewName] = { directory: config.directory, files: validFiles };
            this.render(viewName);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    },

    parseCheckboxItems(markdown) {
        const lines = markdown.split('\n');
        const items = [];

        lines.forEach(line => {
            const match = line.match(/^- \[([ x])\] (.+)$/);
            if (!match) return;
            const checked = match[1] === 'x';
            const parsed = this.parseHighlight(match[2]);
            items.push({ text: parsed.text, checked, highlight: parsed.highlight });
        });

        return items;
    },

    parseHighlight(text) {
        const match = text.match(/\s*<!--\s*hl:([a-z]+)\s*-->\s*$/i);
        if (!match) return { text, highlight: null };
        return {
            text: text.replace(match[0], '').trim(),
            highlight: match[1].toLowerCase()
        };
    },

    formatItemLine(item) {
        const highlightSuffix = item.highlight ? ` <!-- hl:${item.highlight} -->` : '';
        const checkMark = item.checked ? 'x' : ' ';
        return `- [${checkMark}] ${item.text}${highlightSuffix}`;
    },

    render(viewName) {
        const config = this.config[viewName];
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

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header" onclick="Viewer.toggleAccordion('${viewName}', ${fileIndex})">`;
            html += `<span class="accordion-icon">&#9654;</span>`;
            html += `<span>${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="checklist">`;

            file.items.forEach((item, itemIndex) => {
                if (!item.checked) {
                    const highlightClass = item.highlight ? ` highlight-${item.highlight}` : '';
                    html += `
                        <div class="checklist-item${highlightClass}" data-view="${viewName}" data-file-index="${fileIndex}" data-item-index="${itemIndex}">
                            <input type="checkbox" disabled aria-hidden="true">
                            <span class="checklist-text">${item.text}</span>
                        </div>
                    `;
                }
            });

            html += `</div></div></div>`;
        });

        html += '</div>';
        content.innerHTML = html;
        this.bindInteractions(content);
    },

    toggleAccordion(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        data.files[fileIndex].expanded = !data.files[fileIndex].expanded;
        this.render(viewName);
    },

    async toggleAccordionItem(checkbox) {
        const viewName = checkbox.dataset.view;
        const fileIndex = parseInt(checkbox.dataset.fileIndex, 10);
        const itemIndex = parseInt(checkbox.dataset.itemIndex, 10);
        await this.completeItem(viewName, fileIndex, itemIndex);
    },

    async completeItem(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        item.checked = true;
        await this.moveItemToDone(viewName, data.directory, file, item, itemIndex);
        this.render(viewName);
    },

    async moveItemToDone(viewName, directory, file, item, itemIndex) {
        const today = new Date().toISOString().split('T')[0];
        const api = new GitHubAPI(AppState.token, AppState.repo);

        try {
            let doneContent = '';
            const donePath = `${directory}/Done.md`;
            try {
                doneContent = await api.getFile(donePath);
            } catch (error) {
                doneContent = `# ${directory.split('/').pop()} - Completed\n\n<!-- Checked items moved here with completion dates -->\n\n`;
            }

            doneContent += `- [x] [${file.name}] ${item.text} _(${today})_\n`;

            const sourceContent = await api.getFile(file.path);
            const newSourceContent = this.removeCheckboxLineByIndex(sourceContent, itemIndex);

            if (AppState.isOnline) {
                await api.updateFile(donePath, doneContent, `Archive: ${item.text}`);
                await api.updateFile(file.path, newSourceContent, `Remove completed: ${item.text}`);
                if (window.UI && UI.showToast) {
                    UI.showToast('Moved to Done', 'success');
                }
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
                if (window.UI && UI.showToast) {
                    UI.showToast('Queued for sync', 'info');
                }
            }

            file.items = this.parseCheckboxItems(newSourceContent);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Failed to move item: ' + error.message, 'error');
            }
            item.checked = false;
        }
    },

    removeCheckboxLineByIndex(sourceContent, targetIndex) {
        const lines = sourceContent.split('\n');
        let checkboxIndex = -1;
        const newLines = lines.filter(line => {
            const match = line.match(/^- \[([ x])\] (.+)$/);
            if (!match) return true;
            checkboxIndex += 1;
            return checkboxIndex !== targetIndex;
        });
        return newLines.join('\n');
    },

    updateCheckboxLineByIndex(sourceContent, targetIndex, newLine) {
        const lines = sourceContent.split('\n');
        let checkboxIndex = -1;
        const newLines = lines.map(line => {
            const match = line.match(/^- \[([ x])\] (.+)$/);
            if (!match) return line;
            checkboxIndex += 1;
            if (checkboxIndex === targetIndex) {
                return newLine;
            }
            return line;
        });
        return newLines.join('\n');
    },

    reorderUncheckedLines(sourceContent, uncheckedItems) {
        const lines = sourceContent.split('\n');
        let uncheckedIndex = 0;
        const newLines = lines.map(line => {
            const match = line.match(/^- \[ \] (.+)$/);
            if (!match) return line;
            const item = uncheckedItems[uncheckedIndex];
            uncheckedIndex += 1;
            if (!item) return line;
            return this.formatItemLine({ ...item, checked: false });
        });
        return newLines.join('\n');
    },

    async updateSourceFile(path, content, message, toastMessage) {
        const api = new GitHubAPI(AppState.token, AppState.repo);
        if (AppState.isOnline) {
            await api.updateFile(path, content, message);
            if (toastMessage && window.UI && UI.showToast) {
                UI.showToast(toastMessage, 'success');
            }
        } else {
            await QueueManager.enqueue({
                type: 'update_file',
                data: { path, content, message: `${message} (offline)` },
                description: message
            });
            if (toastMessage && window.UI && UI.showToast) {
                UI.showToast('Queued for sync', 'info');
            }
        }
    },

    bindInteractions(content) {
        if (content.dataset.viewerBound) return;
        content.dataset.viewerBound = 'true';
        content.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        content.addEventListener('pointermove', this.handlePointerMove.bind(this));
        content.addEventListener('pointerup', this.handlePointerUp.bind(this));
        content.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    },

    handlePointerDown(event) {
        const itemEl = event.target.closest('.checklist-item');
        if (!itemEl) return;
        if (event.target.closest('.checklist-edit')) return;

        this.hideHighlightMenu();

        const viewName = itemEl.dataset.view;
        const fileIndex = parseInt(itemEl.dataset.fileIndex, 10);
        const itemIndex = parseInt(itemEl.dataset.itemIndex, 10);

        if (!this.isGestureTargetValid(viewName, fileIndex, itemIndex)) return;

        const listEl = itemEl.closest('.checklist');
        const gestureState = {
            pointerId: event.pointerId,
            itemEl,
            listEl,
            viewName,
            fileIndex,
            itemIndex,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            longPressTriggered: false,
            dragging: false,
            swipeTriggered: false,
            dragInsertIndex: null,
            longPressTimer: null
        };

        gestureState.longPressTimer = window.setTimeout(() => {
            gestureState.longPressTriggered = true;
            itemEl.classList.add('long-press');
        }, 500);

        if (itemEl.setPointerCapture) {
            itemEl.setPointerCapture(event.pointerId);
        }
        this.gestureState = gestureState;
    },

    handlePointerMove(event) {
        const state = this.gestureState;
        if (!state || state.pointerId !== event.pointerId) return;

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        state.lastX = event.clientX;
        state.lastY = event.clientY;

        if (!state.longPressTriggered && !state.swipeTriggered) {
            if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                state.swipeTriggered = true;
                window.clearTimeout(state.longPressTimer);
                this.completeItem(state.viewName, state.fileIndex, state.itemIndex);
                this.resetGestureState();
                return;
            }
        }

        if (state.longPressTriggered) {
            if (!state.dragging && Math.abs(dy) > 10) {
                this.startDrag(state);
            }
            if (state.dragging) {
                this.updateDragPosition(state, event.clientY);
                event.preventDefault();
            }
        }
    },

    handlePointerUp(event) {
        const state = this.gestureState;
        if (!state || state.pointerId !== event.pointerId) return;

        window.clearTimeout(state.longPressTimer);

        if (state.dragging) {
            this.finishDrag(state);
            this.resetGestureState();
            return;
        }

        if (state.longPressTriggered && !state.swipeTriggered) {
            this.showHighlightMenu(state.itemEl, state.viewName, state.fileIndex, state.itemIndex);
            this.resetGestureState();
            return;
        }

        if (!state.swipeTriggered) {
            this.startInlineEdit(state.itemEl, state.viewName, state.fileIndex, state.itemIndex);
        }

        this.resetGestureState();
    },

    handlePointerCancel(event) {
        const state = this.gestureState;
        if (!state || state.pointerId !== event.pointerId) return;
        window.clearTimeout(state.longPressTimer);
        if (state.dragging) {
            this.cleanupDrag(state);
        }
        this.resetGestureState();
    },

    resetGestureState() {
        if (!this.gestureState) return;
        if (this.gestureState.itemEl) {
            this.gestureState.itemEl.classList.remove('long-press');
        }
        this.gestureState = null;
    },

    isGestureTargetValid(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return false;
        return Boolean(data.files[fileIndex].items[itemIndex]);
    },

    startInlineEdit(itemEl, viewName, fileIndex, itemIndex) {
        if (itemEl.classList.contains('editing')) return;
        const textEl = itemEl.querySelector('.checklist-text');
        if (!textEl) return;

        const currentText = textEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'checklist-edit';
        input.value = currentText;

        itemEl.classList.add('editing');
        textEl.replaceWith(input);
        input.focus();
        input.setSelectionRange(currentText.length, currentText.length);

        const cancelEdit = () => {
            if (!itemEl.classList.contains('editing')) return;
            input.replaceWith(textEl);
            itemEl.classList.remove('editing');
        };

        const commitEdit = async () => {
            const newText = input.value.trim();
            if (!newText) {
                cancelEdit();
                return;
            }
            await this.updateItemText(viewName, fileIndex, itemIndex, newText);
        };

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitEdit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
            }
        });

        input.addEventListener('blur', () => {
            commitEdit();
        });
    },

    async updateItemText(viewName, fileIndex, itemIndex, newText) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const sourceContent = await api.getFile(file.path);
            const updatedItem = { ...item, text: newText };
            const newLine = this.formatItemLine(updatedItem);
            const newSourceContent = this.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, `Edit item: ${newText}`, 'Updated');
            file.items = this.parseCheckboxItems(newSourceContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Edit failed: ' + error.message, 'error');
            }
            this.render(viewName);
        }
    },

    startDrag(state) {
        state.dragging = true;
        state.itemEl.classList.add('dragging');
        state.dragDivider = document.createElement('div');
        state.dragDivider.className = 'drag-divider';
        state.listEl.appendChild(state.dragDivider);
        this.updateDragPosition(state, state.lastY);
    },

    updateDragPosition(state, pointerY) {
        const items = Array.from(state.listEl.querySelectorAll('.checklist-item'));
        const itemsExcludingActive = items.filter(item => item !== state.itemEl);
        if (itemsExcludingActive.length === 0) return;

        let insertIndex = itemsExcludingActive.length;
        for (let i = 0; i < itemsExcludingActive.length; i += 1) {
            const rect = itemsExcludingActive[i].getBoundingClientRect();
            if (pointerY < rect.top + rect.height / 2) {
                insertIndex = i;
                break;
            }
        }

        const listRect = state.listEl.getBoundingClientRect();
        let top;
        if (insertIndex === itemsExcludingActive.length) {
            const lastRect = itemsExcludingActive[itemsExcludingActive.length - 1].getBoundingClientRect();
            top = lastRect.bottom - listRect.top;
        } else {
            const targetRect = itemsExcludingActive[insertIndex].getBoundingClientRect();
            top = targetRect.top - listRect.top;
        }

        state.dragInsertIndex = insertIndex;
        state.dragDivider.style.top = `${top}px`;
    },

    finishDrag(state) {
        const listItems = Array.from(state.listEl.querySelectorAll('.checklist-item'));
        const fromIndex = listItems.indexOf(state.itemEl);
        if (fromIndex === -1 || state.dragInsertIndex === null) {
            this.cleanupDrag(state);
            return;
        }

        const withoutActive = listItems.filter(item => item !== state.itemEl);
        const newOrder = withoutActive.slice();
        newOrder.splice(state.dragInsertIndex, 0, state.itemEl);
        const toIndex = newOrder.indexOf(state.itemEl);

        if (fromIndex !== toIndex) {
            this.reorderItems(state.viewName, state.fileIndex, fromIndex, toIndex);
        }
        this.cleanupDrag(state);
    },

    cleanupDrag(state) {
        if (state.itemEl) {
            state.itemEl.classList.remove('dragging');
        }
        if (state.dragDivider && state.dragDivider.parentNode) {
            state.dragDivider.parentNode.removeChild(state.dragDivider);
        }
        state.dragDivider = null;
        state.dragging = false;
        state.dragInsertIndex = null;
    },

    async reorderItems(viewName, fileIndex, fromIndex, toIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];

        const uncheckedItems = file.items.filter(item => !item.checked);
        if (fromIndex < 0 || fromIndex >= uncheckedItems.length || toIndex < 0 || toIndex >= uncheckedItems.length) {
            return;
        }

        const [moved] = uncheckedItems.splice(fromIndex, 1);
        uncheckedItems.splice(toIndex, 0, moved);

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const sourceContent = await api.getFile(file.path);
            const newSourceContent = this.reorderUncheckedLines(sourceContent, uncheckedItems);

            await this.updateSourceFile(file.path, newSourceContent, `Reorder items in ${file.name}`, 'Reordered');
            file.items = this.parseCheckboxItems(newSourceContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Reorder failed: ' + error.message, 'error');
            }
            this.render(viewName);
        }
    },

    ensureHighlightMenu() {
        if (this.highlightMenu) return this.highlightMenu;
        const menu = document.createElement('div');
        menu.id = 'highlightMenu';
        menu.className = 'highlight-menu hidden';

        menu.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;
            const color = button.dataset.color;
            const viewName = menu.dataset.view;
            const fileIndex = parseInt(menu.dataset.fileIndex, 10);
            const itemIndex = parseInt(menu.dataset.itemIndex, 10);
            this.applyHighlight(viewName, fileIndex, itemIndex, color);
            this.hideHighlightMenu();
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
    },

    showHighlightMenu(itemEl, viewName, fileIndex, itemIndex) {
        const menu = this.ensureHighlightMenu();
        const data = AppState.data[viewName];
        const item = data?.files?.[fileIndex]?.items?.[itemIndex];
        const current = item?.highlight || 'none';
        const colors = [
            { id: 'none', label: 'None' },
            { id: 'yellow', label: 'Yellow' },
            { id: 'green', label: 'Green' },
            { id: 'blue', label: 'Blue' },
            { id: 'pink', label: 'Pink' }
        ];

        menu.innerHTML = colors.map(color => {
            const activeClass = color.id === current ? ' active' : '';
            return `<button type="button" class="highlight-menu-btn${activeClass}" data-color="${color.id}">
                <span class="highlight-swatch highlight-${color.id}"></span>
                <span>${color.label}</span>
            </button>`;
        }).join('');

        menu.dataset.view = viewName;
        menu.dataset.fileIndex = String(fileIndex);
        menu.dataset.itemIndex = String(itemIndex);

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
    },

    hideHighlightMenu() {
        if (!this.highlightMenu) return;
        this.highlightMenu.classList.add('hidden');
    },

    async applyHighlight(viewName, fileIndex, itemIndex, color) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        const highlight = color === 'none' ? null : color;
        const updatedItem = { ...item, highlight };

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const sourceContent = await api.getFile(file.path);
            const newLine = this.formatItemLine(updatedItem);
            const newSourceContent = this.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, `Highlight: ${item.text}`, 'Highlight updated');
            file.items = this.parseCheckboxItems(newSourceContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Highlight failed: ' + error.message, 'error');
            }
            this.render(viewName);
        }
    }
};

window.Viewer = Viewer;
