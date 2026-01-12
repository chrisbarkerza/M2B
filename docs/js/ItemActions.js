/**
 * ItemActions - Item completion, indentation, and highlighting
 * Handles item state changes (done, indent, outdent, highlight)
 * Dependencies: AppState, LocalStorageManager, ChecklistParser, ViewRenderer, UI (toast)
 */
class ItemActions {
    /**
     * Mark item as complete and move to Done.md
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static async completeItem(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        const item = file.items[itemIndex];
        if (!item) return;

        item.checked = true;
        await this.moveItemToDone(viewName, data.directory, file, item, itemIndex);
        ViewRenderer.render(viewName);
    }

    /**
     * Move completed item to Done.md file
     * @param {string} viewName - View name
     * @param {string} directory - Directory path
     * @param {object} file - File object
     * @param {object} item - Item object
     * @param {number} itemIndex - Item index
     */
    static async moveItemToDone(viewName, directory, file, item, itemIndex) {
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
            const newSourceContent = ChecklistParser.removeCheckboxLineByIndex(sourceContent, itemIndex);

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

            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Failed to move item: ' + error.message, 'error');
            }
            item.checked = false;
        }
    }

    /**
     * Increase item indent level (and all children)
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static async indentItem(viewName, fileIndex, itemIndex) {
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

            // Get all items that need to be indented (parent + children)
            const itemsToIndent = this.getItemWithChildren(file.items, itemIndex);

            // Update content by indenting all items
            let newSourceContent = sourceContent;
            for (const idx of itemsToIndent) {
                const itemToUpdate = file.items[idx];
                const updatedItem = { ...itemToUpdate, indent: Math.min(4, (itemToUpdate.indent || 0) + 1) };
                const newLine = ChecklistParser.formatItemLine(updatedItem);
                newSourceContent = ChecklistParser.updateCheckboxLineByIndex(newSourceContent, idx, newLine);
            }

            const itemCount = itemsToIndent.length;
            const message = itemCount > 1 ? `Indented ${itemCount} items` : 'Item indented';
            await this.updateSourceFile(file.path, newSourceContent, 'Indent item', message);
            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
            ViewRenderer.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Indent failed: ' + error.message, 'error');
            }
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Decrease item indent level (and all children)
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static async outdentItem(viewName, fileIndex, itemIndex) {
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

            // Get all items that need to be outdented (parent + children)
            const itemsToOutdent = this.getItemWithChildren(file.items, itemIndex);

            // Update content by outdenting all items
            let newSourceContent = sourceContent;
            for (const idx of itemsToOutdent) {
                const itemToUpdate = file.items[idx];
                const updatedItem = { ...itemToUpdate, indent: Math.max(0, (itemToUpdate.indent || 0) - 1) };
                const newLine = ChecklistParser.formatItemLine(updatedItem);
                newSourceContent = ChecklistParser.updateCheckboxLineByIndex(newSourceContent, idx, newLine);
            }

            const itemCount = itemsToOutdent.length;
            const message = itemCount > 1 ? `Outdented ${itemCount} items` : 'Item outdented';
            await this.updateSourceFile(file.path, newSourceContent, 'Outdent item', message);
            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
            ViewRenderer.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Outdent failed: ' + error.message, 'error');
            }
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Apply highlight color to item
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     * @param {string} color - Color name or 'none'
     */
    static async applyHighlight(viewName, fileIndex, itemIndex, color) {
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

            const newLine = ChecklistParser.formatItemLine(updatedItem);
            const newSourceContent = ChecklistParser.updateCheckboxLineByIndex(sourceContent, itemIndex, newLine);

            await this.updateSourceFile(file.path, newSourceContent, `Highlight: ${item.text}`, 'Highlight updated');
            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
            ViewRenderer.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Highlight failed: ' + error.message, 'error');
            }
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Get child items of a parent item
     * @param {Array} fileItems - All items in file
     * @param {number} parentIndex - Parent item index
     * @returns {Array} Array of child indices
     */
    static getItemChildren(fileItems, parentIndex) {
        const parent = fileItems[parentIndex];
        if (!parent) return [];

        const parentIndent = parent.indent || 0;
        const children = [];

        // Find all consecutive items with greater indent than parent
        for (let i = parentIndex + 1; i < fileItems.length; i++) {
            const itemIndent = fileItems[i].indent || 0;
            if (itemIndent <= parentIndent) break; // No longer a child
            children.push(i);
        }

        return children;
    }

    /**
     * Get item with all its children
     * @param {Array} fileItems - All items in file
     * @param {number} parentIndex - Parent item index
     * @returns {Array} Array of indices (parent + children)
     */
    static getItemWithChildren(fileItems, parentIndex) {
        return [parentIndex, ...this.getItemChildren(fileItems, parentIndex)];
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
window.ItemActions = ItemActions;
