/**
 * GestureHandler - Detect and coordinate user gestures
 * Handles tap, long-press, swipe, drag, and keyboard interactions
 * Dependencies: AppState, ItemEditor, ItemActions, DragReorder, HighlightMenu
 */
class GestureHandler {
    static gestureState = null;

    /**
     * Bind interaction handlers to content element
     * @param {HTMLElement} content - Container element
     */
    static bindInteractions(content) {
        if (content.dataset.viewerBound) return;
        content.dataset.viewerBound = 'true';
        content.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        content.addEventListener('pointermove', this.handlePointerMove.bind(this));
        content.addEventListener('pointerup', this.handlePointerUp.bind(this));
        content.addEventListener('pointercancel', this.handlePointerCancel.bind(this));

        // Prevent browser's default long-press context menu on checklist items
        content.addEventListener('contextmenu', (event) => {
            // Check if the event target or any parent is a checklist item
            const itemEl = event.target.closest('.checklist-item');
            if (itemEl) {
                event.preventDefault();
                return false;
            }
        });

        // Add keyboard shortcuts for item manipulation
        content.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    static handleKeyDown(event) {
        // Check for Cmd+Shift+Arrow (Mac) or Ctrl+Shift+Arrow (Windows/Linux)
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? event.metaKey : event.ctrlKey;

        if (!modifierKey || !event.shiftKey) return;

        // Find the currently focused or editing item
        const editingItem = event.target.closest('.checklist-item');
        if (!editingItem) return;

        const viewName = editingItem.dataset.view;
        const fileIndex = parseInt(editingItem.dataset.fileIndex, 10);
        const itemIndex = parseInt(editingItem.dataset.itemIndex, 10);

        if (!this.isGestureTargetValid(viewName, fileIndex, itemIndex)) return;

        const data = AppState.data[viewName];
        const file = data.files[fileIndex];
        const uncheckedItems = file.items.filter(item => !item.checked);

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                ItemActions.outdentItem(viewName, fileIndex, itemIndex);
                break;

            case 'ArrowRight':
                event.preventDefault();
                ItemActions.indentItem(viewName, fileIndex, itemIndex);
                break;

            case 'ArrowUp':
                event.preventDefault();
                // Move item up (swap with previous item)
                const prevIndex = this.findPreviousItemIndex(uncheckedItems, itemIndex);
                if (prevIndex !== null) {
                    DragReorder.reorderItems(viewName, fileIndex, itemIndex, prevIndex);
                }
                break;

            case 'ArrowDown':
                event.preventDefault();
                // Move item down (swap with next item)
                const nextIndex = this.findNextItemIndex(uncheckedItems, itemIndex);
                if (nextIndex !== null) {
                    DragReorder.reorderItems(viewName, fileIndex, itemIndex, nextIndex);
                }
                break;
        }
    }

    /**
     * Find previous item index (start of previous group)
     * @param {Array} uncheckedItems - Array of unchecked items
     * @param {number} currentIndex - Current item index
     * @returns {number|null} Previous group start index
     */
    static findPreviousItemIndex(uncheckedItems, currentIndex) {
        if (currentIndex === 0) return null;

        // Get the group being moved (parent + children)
        const indicesToMove = ItemActions.getItemWithChildren(uncheckedItems, currentIndex);
        const firstIndexInGroup = indicesToMove[0];

        if (firstIndexInGroup === 0) return null;

        // Find the start of the previous group
        const prevItemIndex = firstIndexInGroup - 1;

        // Find the start of the previous group by walking backwards
        let targetIndex = prevItemIndex;
        for (let i = prevItemIndex - 1; i >= 0; i--) {
            const itemIndent = uncheckedItems[i].indent || 0;
            const prevIndent = uncheckedItems[i + 1].indent || 0;
            if (itemIndent <= prevIndent && i + 1 !== prevItemIndex) {
                break;
            }
            targetIndex = i;
        }

        return targetIndex;
    }

    /**
     * Find next item index (end of next group + 1)
     * @param {Array} uncheckedItems - Array of unchecked items
     * @param {number} currentIndex - Current item index
     * @returns {number|null} Position after next group
     */
    static findNextItemIndex(uncheckedItems, currentIndex) {
        // Find the index after the current item's group (skipping children)
        const indicesToMove = ItemActions.getItemWithChildren(uncheckedItems, currentIndex);
        const lastIndexInGroup = indicesToMove[indicesToMove.length - 1];

        if (lastIndexInGroup >= uncheckedItems.length - 1) return null;

        // The next position is right after this group
        const nextItemIndex = lastIndexInGroup + 1;

        // Find the end of the next group
        const nextGroupIndices = ItemActions.getItemWithChildren(uncheckedItems, nextItemIndex);
        const nextGroupEnd = nextGroupIndices[nextGroupIndices.length - 1];

        // We want to move to the position after the next group
        return nextGroupEnd + 1;
    }

    /**
     * Handle pointer down event
     * @param {PointerEvent} event - Pointer event
     */
    static handlePointerDown(event) {
        const itemEl = event.target.closest('.checklist-item');
        if (!itemEl) return;
        if (event.target.closest('.checklist-edit')) return;

        HighlightMenu.hideHighlightMenu();

        const startedOnBullet = Boolean(event.target.closest('.bullet'));
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
            startedOnBullet,
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
    }

    /**
     * Handle pointer move event
     * @param {PointerEvent} event - Pointer event
     */
    static handlePointerMove(event) {
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
                ItemActions.indentItem(state.viewName, state.fileIndex, state.itemIndex);
                this.resetGestureState();
                return;
            }
            // Swipe left to outdent (50px threshold)
            if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                state.swipeTriggered = true;
                window.clearTimeout(state.longPressTimer);
                ItemActions.outdentItem(state.viewName, state.fileIndex, state.itemIndex);
                this.resetGestureState();
                return;
            }
        }

        if (state.longPressTriggered) {
            if (!state.dragging && Math.abs(dy) > 10) {
                DragReorder.startDrag(state);
            }
            if (state.dragging) {
                DragReorder.updateDragPosition(state, event.clientY);
                event.preventDefault();
            }
        }
    }

    /**
     * Handle pointer up event
     * @param {PointerEvent} event - Pointer event
     */
    static handlePointerUp(event) {
        const state = this.gestureState;
        if (!state || state.pointerId !== event.pointerId) return;

        window.clearTimeout(state.longPressTimer);

        if (state.dragging) {
            DragReorder.finishDrag(state);
            this.resetGestureState();
            return;
        }

        if (state.longPressTriggered && !state.swipeTriggered) {
            HighlightMenu.showHighlightMenu(state.itemEl, state.viewName, state.fileIndex, state.itemIndex);
            this.resetGestureState();
            return;
        }

        if (!state.swipeTriggered) {
            const clickedBullet = state.startedOnBullet || Boolean(event.target.closest('.bullet'));
            if (clickedBullet) {
                this.resetGestureState();
                return;
            }

            // Click on text - start inline edit
            ItemEditor.startInlineEdit(state.itemEl, state.viewName, state.fileIndex, state.itemIndex);
        }

        this.resetGestureState();
    }

    /**
     * Handle pointer cancel event
     * @param {PointerEvent} event - Pointer event
     */
    static handlePointerCancel(event) {
        const state = this.gestureState;
        if (!state || state.pointerId !== event.pointerId) return;
        window.clearTimeout(state.longPressTimer);
        if (state.dragging) {
            DragReorder.cleanupDrag(state);
        }
        this.resetGestureState();
    }

    /**
     * Reset gesture state
     */
    static resetGestureState() {
        if (!this.gestureState) return;
        if (this.gestureState.itemEl) {
            this.gestureState.itemEl.classList.remove('long-press');
        }
        this.gestureState = null;
    }

    /**
     * Check if gesture target is valid
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     * @returns {boolean} True if valid
     */
    static isGestureTargetValid(viewName, fileIndex, itemIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return false;
        return Boolean(data.files[fileIndex].items[itemIndex]);
    }
}

// Expose globally
window.GestureHandler = GestureHandler;
