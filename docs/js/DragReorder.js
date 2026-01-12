/**
 * DragReorder - Drag-and-drop visual feedback and item reordering/moving
 * Handles drag operations, visual feedback, and item reordering
 * Dependencies: AppState, LocalStorageManager, ChecklistParser, ViewRenderer, ViewerConfig, UI (toast)
 */
class DragReorder {
    /**
     * Start drag operation
     * @param {object} state - Gesture state object
     */
    static startDrag(state) {
        state.dragging = true;
        state.itemEl.classList.add('dragging');

        // Highlight all items that will be moved (parent + children)
        const data = AppState.data[state.viewName];
        const file = data.files[state.fileIndex];
        const uncheckedItems = file.items.filter(item => !item.checked);
        const indicesToMove = ItemActions.getItemWithChildren(uncheckedItems, state.itemIndex);

        // Store the child elements to highlight them
        state.draggedItemElements = [];
        const config = ViewerConfig.getConfig(state.viewName);
        const content = document.getElementById(config.contentId);
        for (const idx of indicesToMove) {
            const itemEl = content.querySelector(`.checklist-item[data-item-index="${idx}"]`);
            if (itemEl) {
                itemEl.classList.add('dragging');
                state.draggedItemElements.push(itemEl);
            }
        }

        state.dragDivider = document.createElement('div');
        state.dragDivider.className = 'drag-divider';
        state.listEl.appendChild(state.dragDivider);
        this.updateDragPosition(state, state.lastY);
    }

    /**
     * Update drag position and visual feedback
     * @param {object} state - Gesture state object
     * @param {number} pointerY - Current pointer Y position
     */
    static updateDragPosition(state, pointerY) {
        // Find all checklists in the view (to support cross-card dragging)
        const config = ViewerConfig.getConfig(state.viewName);
        const content = document.getElementById(config.contentId);
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
    }

    /**
     * Finish drag operation and perform reorder/move
     * @param {object} state - Gesture state object
     */
    static finishDrag(state) {
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
    }

    /**
     * Cleanup drag visual elements
     * @param {object} state - Gesture state object
     */
    static cleanupDrag(state) {
        if (state.itemEl) {
            state.itemEl.classList.remove('dragging');
        }
        // Remove dragging class from all highlighted items
        if (state.draggedItemElements) {
            for (const el of state.draggedItemElements) {
                el.classList.remove('dragging');
            }
            state.draggedItemElements = null;
        }
        if (state.dragDivider && state.dragDivider.parentNode) {
            state.dragDivider.parentNode.removeChild(state.dragDivider);
        }
        state.dragDivider = null;
        state.dragging = false;
        state.dragInsertIndex = null;
    }

    /**
     * Reorder items within the same file
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} fromIndex - Source index
     * @param {number} toIndex - Destination index
     */
    static async reorderItems(viewName, fileIndex, fromIndex, toIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        const file = data.files[fileIndex];

        const uncheckedItems = file.items.filter(item => !item.checked);
        if (fromIndex < 0 || fromIndex >= uncheckedItems.length || toIndex < 0 || toIndex >= uncheckedItems.length) {
            return;
        }

        // Get the indices of items being moved (parent + children)
        const indicesToMove = ItemActions.getItemWithChildren(uncheckedItems, fromIndex);

        // Extract the actual items to move
        const movedItems = indicesToMove.map(idx => uncheckedItems[idx]);

        // Remove items from their original positions (in reverse order to maintain indices)
        const sortedIndices = [...indicesToMove].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            uncheckedItems.splice(idx, 1);
        }

        // Calculate new insert position (adjust for removed items before toIndex)
        let adjustedToIndex = toIndex;
        for (const idx of indicesToMove) {
            if (idx < toIndex) {
                adjustedToIndex--;
            }
        }

        // Insert all items at the new position
        uncheckedItems.splice(adjustedToIndex, 0, ...movedItems);

        try {
            // Get content from local storage
            const localFile = await LocalStorageManager.getFile(file.path);
            const sourceContent = localFile ? localFile.content : '';
            const newSourceContent = ChecklistParser.reorderUncheckedLines(sourceContent, uncheckedItems);

            const itemCount = movedItems.length;
            const message = itemCount > 1 ? `Reordered ${itemCount} items` : 'Reordered';
            await this.updateSourceFile(file.path, newSourceContent, `Reorder items in ${file.name}`, message);
            file.items = ChecklistParser.parseCheckboxItems(newSourceContent);
            ViewRenderer.render(viewName);

            // Restore focus to the moved item at its new position
            setTimeout(() => {
                const config = ViewerConfig.getConfig(viewName);
                const content = document.getElementById(config.contentId);
                const newItemEl = content.querySelector(`.checklist-item[data-item-index="${adjustedToIndex}"]`);
                if (newItemEl) {
                    newItemEl.focus();
                }
            }, 50);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Reorder failed: ' + error.message, 'error');
            }
            ViewRenderer.render(viewName);
        }
    }

    /**
     * Move item to a different file
     * @param {string} viewName - View name
     * @param {number} fromFileIndex - Source file index
     * @param {number} itemIndex - Item index
     * @param {number} toFileIndex - Destination file index
     * @param {number} insertIndex - Insert position in destination
     */
    static async moveItemToFile(viewName, fromFileIndex, itemIndex, toFileIndex, insertIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fromFileIndex] || !data.files[toFileIndex]) return;

        const fromFile = data.files[fromFileIndex];
        const toFile = data.files[toFileIndex];

        const uncheckedItems = fromFile.items.filter(item => !item.checked);
        if (itemIndex < 0 || itemIndex >= uncheckedItems.length) return;

        // Get the item and its children
        const indicesToMove = ItemActions.getItemWithChildren(uncheckedItems, itemIndex);
        const itemsToMove = indicesToMove.map(idx => uncheckedItems[idx]);

        try {
            // Get content from both files
            const fromLocalFile = await LocalStorageManager.getFile(fromFile.path);
            const toLocalFile = await LocalStorageManager.getFile(toFile.path);
            const fromContent = fromLocalFile ? fromLocalFile.content : '';
            const toContent = toLocalFile ? toLocalFile.content : '';

            // Remove items from source file (in reverse order to maintain indices)
            let newFromContent = fromContent;
            const sortedIndices = [...indicesToMove].sort((a, b) => b - a);
            for (const idx of sortedIndices) {
                newFromContent = ChecklistParser.removeCheckboxLineByIndex(newFromContent, idx);
            }

            // Add items to destination file
            const toUncheckedItems = toFile.items.filter(item => !item.checked);
            toUncheckedItems.splice(insertIndex, 0, ...itemsToMove);

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
                        // Insert all moved items here
                        for (const item of itemsToMove) {
                            newToLines.push(ChecklistParser.formatItemLine(item));
                        }
                        inserted = true;
                    }
                }
                newToLines.push(line);
            });

            // If we haven't inserted yet (inserting at end), add them now
            if (!inserted) {
                for (const item of itemsToMove) {
                    newToLines.push(ChecklistParser.formatItemLine(item));
                }
            }

            const newToContent = newToLines.join('\n');

            // Save both files
            await LocalStorageManager.saveFile(fromFile.path, newFromContent, true);
            await LocalStorageManager.saveFile(toFile.path, newToContent, true);

            const itemCount = itemsToMove.length;
            const message = itemCount > 1 ? `Moved ${itemCount} items to ${toFile.name}` : `Item moved to ${toFile.name}`;
            if (window.UI && UI.showToast) {
                UI.showToast(message, 'success');
            }

            // Update sync badge
            if (window.UI && UI.updateSyncBadge) {
                UI.updateSyncBadge();
            }

            // Refresh items from new content
            fromFile.items = ChecklistParser.parseCheckboxItems(newFromContent);
            toFile.items = ChecklistParser.parseCheckboxItems(newToContent);
            ViewRenderer.render(viewName);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Move failed: ' + error.message, 'error');
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
window.DragReorder = DragReorder;
