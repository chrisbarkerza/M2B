/**
 * ItemEditor - In-place text editing and item creation
 * Handles inline editing of checklist items
 * Dependencies: AppState, LocalStorageManager, ChecklistParser, ViewRenderer, UI (toast)
 */
class ItemEditor {
    /**
     * Start inline editing of an item
     * @param {HTMLElement} itemEl - The item DOM element
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static startInlineEdit(itemEl, viewName, fileIndex, itemIndex) {
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
    }

    /**
     * Update item text
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     * @param {string} newText - New text content
     */
    static async updateItemText(viewName, fileIndex, itemIndex, newText) {
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
            const newLine = ChecklistParser.formatItemLine(updatedItem);
            const newSourceContent = ChecklistParser.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, `Edit item: ${newText}`, 'Updated');
            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
            ViewRenderer.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Edit failed: ' + error.message, 'error');
            }
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Insert new bullet item before or after current item
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     * @param {boolean} insertAfter - Insert after (true) or before (false) current item
     */
    static async insertNewBullet(viewName, fileIndex, itemIndex, insertAfter) {
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
            const newLine = ChecklistParser.formatItemLine(newItem);

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
                let newSourceContent = lines.join('\n');
                const normalized = ChecklistParser.normalizeCollapseStates(newSourceContent);
                newSourceContent = normalized.content;

                await this.updateSourceFile(file.path, newSourceContent, 'Add new bullet', 'New item added');
                file.items = normalized.items;
                ViewRenderer.render(viewName);

                // Auto-select the new item for editing
                const newItemIndex = insertAfter ? itemIndex + 1 : itemIndex;
                setTimeout(() => {
                    const config = ViewerConfig.getConfig(viewName);
                    const content = document.getElementById(config.contentId);
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
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Update source file (save to local storage)
     * @param {string} path - File path
     * @param {string} content - New content
     * @param {string} message - Commit message (for future use)
     * @param {string} toastMessage - Toast notification message
     */
    static async updateSourceFile(path, content, message, toastMessage) {
        await FileUpdateManager.updateSourceFile(path, content, message, toastMessage);
    }
}

// Expose globally
window.ItemEditor = ItemEditor;
