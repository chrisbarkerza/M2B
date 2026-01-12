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
            // Try to load from local storage first
            const localFiles = await LocalStorageManager.getAllFiles(config.directory);

            if (localFiles.length === 0) {
                // First load: fetch from GitHub
                console.log(`No local files for ${viewName}, loading from GitHub...`);
                await SyncManager.loadAllFromGitHub(viewName);

                // Try again after loading from GitHub
                const refreshedFiles = await LocalStorageManager.getAllFiles(config.directory);
                if (refreshedFiles.length === 0) {
                    content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                    return;
                }
                localFiles.push(...refreshedFiles);
            }

            // Filter out Done.md
            const files = localFiles.filter(f =>
                !f.path.endsWith('Done.md')
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            // Parse files from local storage
            const filesData = files.map(file => {
                const items = this.parseCheckboxItems(file.content);
                return {
                    name: file.path.split('/').pop().replace('.md', ''),
                    path: file.path,
                    items: items,
                    expanded: false
                };
            });

            AppState.data[viewName] = { directory: config.directory, files: filesData };
            this.render(viewName);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    },

    parseCheckboxItems(markdown) {
        const lines = markdown.split('\n');
        const items = [];

        lines.forEach(line => {
            // Match both checkbox format: "- [ ] text" and plain bullet format: "- text"
            // Also capture leading spaces for indentation
            const checkboxMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
            const bulletMatch = line.match(/^(\s*)- (.+)$/);

            if (checkboxMatch) {
                const indent = Math.floor(checkboxMatch[1].length / 2); // 2 spaces per indent
                const checked = checkboxMatch[2] === 'x';
                const parsed = this.parseHighlight(checkboxMatch[3]);
                items.push({ text: parsed.text, checked, highlight: parsed.highlight, indent });
            } else if (bulletMatch) {
                const indent = Math.floor(bulletMatch[1].length / 2); // 2 spaces per indent
                const parsed = this.parseHighlight(bulletMatch[2]);
                items.push({ text: parsed.text, checked: false, highlight: parsed.highlight, indent });
            }
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
        const indent = '  '.repeat(item.indent || 0); // 2 spaces per indent level
        const checkMark = item.checked ? 'x' : ' ';
        return `${indent}- [${checkMark}] ${item.text}${highlightSuffix}`;
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
                    const indentLevel = item.indent || 0;
                    const indentStyle = `padding-left: ${indentLevel * 20}px;`;
                    html += `
                        <div class="checklist-item${highlightClass}" data-view="${viewName}" data-file-index="${fileIndex}" data-item-index="${itemIndex}" style="${indentStyle}">
                            <span class="bullet">⦿</span>
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

        try {
            let doneContent = '';
            const donePath = `${directory}/Done.md`;

            // Try to get from local storage first
            const doneFile = await LocalStorageManager.getFile(donePath);
            if (doneFile) {
                doneContent = doneFile.content;
            } else {
                doneContent = `# ${directory.split('/').pop()} - Completed\n\n<!-- Checked items moved here with completion dates -->\n\n`;
            }

            doneContent += `- [x] [${file.name}] ${item.text} _(${today})_\n`;

            // Get source content from local storage
            const sourceFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = sourceFile ? sourceFile.content : '';
            const newSourceContent = this.removeCheckboxLineByIndex(sourceContent, itemIndex);

            // Save both files to local storage
            await LocalStorageManager.saveFile(donePath, doneContent, true);
            await LocalStorageManager.saveFile(file.path, newSourceContent, true);

            if (window.UI && UI.showToast) {
                UI.showToast('Moved to Done', 'success');
            }

            // Update sync badge
            if (window.UI && UI.updateSyncBadge) {
                UI.updateSyncBadge();
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
            const match = line.match(/^(\s*)- \[([ x])\] (.+)$/);
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
            const match = line.match(/^(\s*)- \[([ x])\] (.+)$/);
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
            const match = line.match(/^(\s*)- \[ \] (.+)$/);
            if (!match) return line;
            const item = uncheckedItems[uncheckedIndex];
            uncheckedIndex += 1;
            if (!item) return line;
            return this.formatItemLine({ ...item, checked: false });
        });
        return newLines.join('\n');
    },

    async updateSourceFile(path, content, message, toastMessage) {
        // Save to local storage immediately (local-first)
        await LocalStorageManager.saveFile(path, content, true);

        // Show instant feedback
        if (toastMessage && window.UI && UI.showToast) {
            UI.showToast('Saved locally', 'success');
        }

        // Update sync badge
        if (window.UI && UI.updateSyncBadge) {
            UI.updateSyncBadge();
        }
    },

    bindInteractions(content) {
        if (content.dataset.viewerBound) return;
        content.dataset.viewerBound = 'true';
        content.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        content.addEventListener('pointermove', this.handlePointerMove.bind(this));
        content.addEventListener('pointerup', this.handlePointerUp.bind(this));
        content.addEventListener('pointercancel', this.handlePointerCancel.bind(this));

        // Prevent browser's default long-press context menu
        content.addEventListener('contextmenu', (event) => {
            const itemEl = event.target.closest('.checklist-item');
            if (itemEl) {
                event.preventDefault();
            }
        });
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
            // Swipe right to indent (50px threshold)
            if (dx > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                state.swipeTriggered = true;
                window.clearTimeout(state.longPressTimer);
                this.indentItem(state.viewName, state.fileIndex, state.itemIndex);
                this.resetGestureState();
                return;
            }
            // Swipe left to outdent (50px threshold)
            if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                state.swipeTriggered = true;
                window.clearTimeout(state.longPressTimer);
                this.outdentItem(state.viewName, state.fileIndex, state.itemIndex);
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

        input.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await commitEdit();
                // Determine if cursor is at beginning or end
                const cursorPos = input.selectionStart;
                const insertAfter = cursorPos === input.value.length;
                await this.insertNewBullet(viewName, fileIndex, itemIndex, insertAfter);
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
            // Get content from local storage
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';

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

    async insertNewBullet(viewName, fileIndex, itemIndex, insertAfter) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        try {
            // Get content from local storage
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';

            // Create new bullet with same indent level as current item
            // Use a space as placeholder text to ensure proper parsing
            const newItem = { text: ' ', checked: false, highlight: null, indent: item.indent || 0 };
            const newLine = this.formatItemLine(newItem);

            // Insert the new line before or after current item
            const lines = sourceContent.split('\n');
            let checkboxIndex = -1;
            let insertLineIndex = -1;

            lines.forEach((line, lineIndex) => {
                const match = line.match(/^(\s*)- (\[[ x]\] )?(.+)$/);
                if (!match) return;
                checkboxIndex += 1;
                if (checkboxIndex === itemIndex) {
                    insertLineIndex = insertAfter ? lineIndex + 1 : lineIndex;
                }
            });

            if (insertLineIndex !== -1) {
                lines.splice(insertLineIndex, 0, newLine);
                const newSourceContent = lines.join('\n');

                await this.updateSourceFile(file.path, newSourceContent, 'Add new bullet', 'New item added');
                file.items = this.parseCheckboxItems(newSourceContent);
                this.render(viewName);

                // Auto-select the new item for editing
                const newItemIndex = insertAfter ? itemIndex + 1 : itemIndex;
                setTimeout(() => {
                    const content = document.getElementById(this.config[viewName].contentId);
                    const newItemEl = content.querySelector(`.checklist-item[data-item-index="${newItemIndex}"]`);
                    if (newItemEl) {
                        this.startInlineEdit(newItemEl, viewName, fileIndex, newItemIndex);
                    }
                }, 100);
            }
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Insert failed: ' + error.message, 'error');
            }
            this.render(viewName);
        }
    },

    async indentItem(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        const currentIndent = item.indent || 0;

        // Max 4 indent levels (0-3)
        if (currentIndent >= 4) {
            if (window.UI && UI.showToast) {
                UI.showToast('Maximum indent level reached', 'info');
            }
            return;
        }

        // Check previous item's indent level - can only be 1 level deeper than previous
        const uncheckedItems = file.items.filter(i => !i.checked);
        const actualIndex = uncheckedItems.indexOf(item);
        if (actualIndex > 0) {
            const prevItem = uncheckedItems[actualIndex - 1];
            const prevIndent = prevItem.indent || 0;
            const maxAllowedIndent = prevIndent + 1;

            if (currentIndent + 1 > maxAllowedIndent) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Can only indent 1 level deeper than previous item', 'info');
                }
                return;
            }
        } else if (currentIndent + 1 > 0) {
            // First item can't be indented
            if (window.UI && UI.showToast) {
                UI.showToast('First item cannot be indented', 'info');
            }
            return;
        }

        try {
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';

            const updatedItem = { ...item, indent: currentIndent + 1 };
            const newLine = this.formatItemLine(updatedItem);
            const newSourceContent = this.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, 'Indent item', 'Item indented');
            file.items = this.parseCheckboxItems(newSourceContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Indent failed: ' + error.message, 'error');
            }
            this.render(viewName);
        }
    },

    async outdentItem(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        // Can't outdent if already at level 0
        if ((item.indent || 0) === 0) {
            if (window.UI && UI.showToast) {
                UI.showToast('Already at minimum indent level', 'info');
            }
            return;
        }

        try {
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';

            const updatedItem = { ...item, indent: (item.indent || 0) - 1 };
            const newLine = this.formatItemLine(updatedItem);
            const newSourceContent = this.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, 'Outdent item', 'Item outdented');
            file.items = this.parseCheckboxItems(newSourceContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Outdent failed: ' + error.message, 'error');
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
        // Find all checklists in the view (to support cross-card dragging)
        const content = document.getElementById(this.config[state.viewName].contentId);
        const allLists = Array.from(content.querySelectorAll('.checklist'));

        // Determine which list the pointer is over
        let targetListEl = state.listEl;
        let targetFileIndex = state.fileIndex;

        for (const list of allLists) {
            const rect = list.getBoundingClientRect();
            if (pointerY >= rect.top && pointerY <= rect.bottom) {
                targetListEl = list;
                const accordionItem = list.closest('.accordion-item');
                if (accordionItem) {
                    targetFileIndex = parseInt(accordionItem.dataset.fileIndex, 10);
                }
                break;
            }
        }

        // Get items from target list
        const items = Array.from(targetListEl.querySelectorAll('.checklist-item'));
        const itemsExcludingActive = items.filter(item => item !== state.itemEl);

        // Calculate insert position
        let insertIndex = itemsExcludingActive.length;
        for (let i = 0; i < itemsExcludingActive.length; i += 1) {
            const rect = itemsExcludingActive[i].getBoundingClientRect();
            if (pointerY < rect.top + rect.height / 2) {
                insertIndex = i;
                break;
            }
        }

        // Position the divider
        const listRect = targetListEl.getBoundingClientRect();
        let top;
        if (itemsExcludingActive.length === 0) {
            // Empty list - show at top
            top = 0;
        } else if (insertIndex === itemsExcludingActive.length) {
            const lastRect = itemsExcludingActive[itemsExcludingActive.length - 1].getBoundingClientRect();
            top = lastRect.bottom - listRect.top;
        } else {
            const targetRect = itemsExcludingActive[insertIndex].getBoundingClientRect();
            top = targetRect.top - listRect.top;
        }

        // Move divider to target list if changed
        if (state.dragDivider.parentNode !== targetListEl) {
            targetListEl.appendChild(state.dragDivider);
        }

        state.dragInsertIndex = insertIndex;
        state.dragTargetFileIndex = targetFileIndex;
        state.dragTargetListEl = targetListEl;
        state.dragDivider.style.top = `${top}px`;
    },

    finishDrag(state) {
        if (state.dragInsertIndex === null) {
            this.cleanupDrag(state);
            return;
        }

        const targetFileIndex = state.dragTargetFileIndex !== undefined ? state.dragTargetFileIndex : state.fileIndex;
        const targetListEl = state.dragTargetListEl || state.listEl;

        // Check if dragging to a different file
        if (targetFileIndex !== state.fileIndex) {
            // Cross-file move
            this.moveItemToFile(state.viewName, state.fileIndex, state.itemIndex, targetFileIndex, state.dragInsertIndex);
        } else {
            // Same file reorder
            const listItems = Array.from(state.listEl.querySelectorAll('.checklist-item'));
            const fromIndex = listItems.indexOf(state.itemEl);
            if (fromIndex === -1) {
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
            // Get content from local storage
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';
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

    async moveItemToFile(viewName, fromFileIndex, itemIndex, toFileIndex, insertIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fromFileIndex] || !data.files[toFileIndex]) return;

        const fromFile = data.files[fromFileIndex];
        const toFile = data.files[toFileIndex];

        const uncheckedItems = fromFile.items.filter(item => !item.checked);
        if (itemIndex < 0 || itemIndex >= uncheckedItems.length) return;

        const itemToMove = uncheckedItems[itemIndex];

        try {
            // Get content from both files
            const fromLocalFile = await LocalStorageManager.getFile(fromFile.path);
            const toLocalFile = await LocalStorageManager.getFile(toFile.path);
            const fromContent = fromLocalFile ? fromLocalFile.content : '';
            const toContent = toLocalFile ? toLocalFile.content : '';

            // Remove item from source file
            const newFromContent = this.removeCheckboxLineByIndex(fromContent, itemIndex);

            // Add item to destination file
            const toUncheckedItems = toFile.items.filter(item => !item.checked);
            toUncheckedItems.splice(insertIndex, 0, itemToMove);

            // Reconstruct destination file content
            const toLines = toContent.split('\n');
            let toCheckboxIndex = -1;
            const newToLines = [];
            let inserted = false;

            toLines.forEach(line => {
                const match = line.match(/^(\s*)- (\[[ x]\] )?(.+)$/);
                if (match) {
                    toCheckboxIndex += 1;
                    if (toCheckboxIndex === insertIndex && !inserted) {
                        // Insert the moved item here
                        newToLines.push(this.formatItemLine(itemToMove));
                        inserted = true;
                    }
                }
                newToLines.push(line);
            });

            // If we haven't inserted yet (inserting at end), add it now
            if (!inserted) {
                newToLines.push(this.formatItemLine(itemToMove));
            }

            const newToContent = newToLines.join('\n');

            // Save both files
            await LocalStorageManager.saveFile(fromFile.path, newFromContent, true);
            await LocalStorageManager.saveFile(toFile.path, newToContent, true);

            if (window.UI && UI.showToast) {
                UI.showToast('Item moved to ' + toFile.name, 'success');
            }

            // Update sync badge
            if (window.UI && UI.updateSyncBadge) {
                UI.updateSyncBadge();
            }

            // Refresh items from new content
            fromFile.items = this.parseCheckboxItems(newFromContent);
            toFile.items = this.parseCheckboxItems(newToContent);
            this.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Move failed: ' + error.message, 'error');
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

            const viewName = menu.dataset.view;
            const fileIndex = parseInt(menu.dataset.fileIndex, 10);
            const itemIndex = parseInt(menu.dataset.itemIndex, 10);

            // Handle color buttons
            if (button.dataset.color) {
                const color = button.dataset.color;
                this.applyHighlight(viewName, fileIndex, itemIndex, color);
                this.hideHighlightMenu();
            }
            // Handle action buttons
            else if (button.dataset.action) {
                const action = button.dataset.action;
                this.hideHighlightMenu();

                if (action === 'done') {
                    this.completeItem(viewName, fileIndex, itemIndex);
                } else if (action === 'indent') {
                    this.indentItem(viewName, fileIndex, itemIndex);
                } else if (action === 'outdent') {
                    this.outdentItem(viewName, fileIndex, itemIndex);
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
    },

    showHighlightMenu(itemEl, viewName, fileIndex, itemIndex) {
        const menu = this.ensureHighlightMenu();
        const data = AppState.data[viewName];
        const item = data?.files?.[fileIndex]?.items?.[itemIndex];
        const current = item?.highlight || 'none';
        const colors = [
            { id: 'yellow', label: 'Yellow' },
            { id: 'green', label: 'Green' },
            { id: 'blue', label: 'Blue' },
            { id: 'pink', label: 'Pink' },
            { id: 'none', label: 'Clear' }
        ];

        // Build HTML with color squares in a row, then Done/Indent/Outdent buttons
        let html = '<div class="color-row">';
        colors.forEach(color => {
            const activeClass = color.id === current ? ' active' : '';
            html += `<button type="button" class="color-square${activeClass}" data-color="${color.id}" title="${color.label}">
                <span class="highlight-swatch highlight-${color.id}"></span>
            </button>`;
        });
        html += '</div>';

        html += '<button type="button" class="menu-action-btn" data-action="done">Done</button>';
        html += '<button type="button" class="menu-action-btn" data-action="indent">Indent</button>';
        html += '<button type="button" class="menu-action-btn" data-action="outdent">Outdent</button>';

        menu.innerHTML = html;

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
            // Get content from local storage
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';

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
