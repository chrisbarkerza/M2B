/**
 * MoveModeManager - Track move mode state for items and files
 * Keeps keyboard move mode active until the user clicks away
 */
class MoveModeManager {
    static active = null;
    static initialized = false;

    static init() {
        if (this.initialized) return;
        this.initialized = true;

        document.addEventListener('pointerdown', event => {
            if (!this.active) return;
            const activeEl = this.getActiveElement();
            if (activeEl && activeEl.contains(event.target)) return;
            this.exit();
        });
    }

    static enterItem(viewName, fileIndex, itemIndex, itemEl = null) {
        this.init();
        this.setActive({
            type: 'item',
            viewName,
            fileIndex,
            itemIndex,
            element: itemEl || null
        }, true);
    }

    static enterFile(viewName, fileIndex, headerEl = null) {
        this.init();
        this.setActive({
            type: 'file',
            viewName,
            fileIndex,
            element: headerEl || null
        }, true);
    }

    static exit() {
        if (!this.active) return;
        this.clearActiveClass();
        this.active = null;
    }

    static isActiveItem(viewName, fileIndex, itemIndex) {
        return Boolean(this.active
            && this.active.type === 'item'
            && this.active.viewName === viewName
            && this.active.fileIndex === fileIndex
            && this.active.itemIndex === itemIndex);
    }

    static isActiveFile(viewName, fileIndex) {
        return Boolean(this.active
            && this.active.type === 'file'
            && this.active.viewName === viewName
            && this.active.fileIndex === fileIndex);
    }

    static updateItemIndex(viewName, fileIndex, fromIndex, toIndex) {
        if (!this.isActiveItem(viewName, fileIndex, fromIndex)) return;
        this.active.itemIndex = toIndex;
    }

    static updateFileIndex(viewName, fromIndex, toIndex) {
        if (!this.isActiveFile(viewName, fromIndex)) return;
        this.active.fileIndex = toIndex;
    }

    static refreshActiveElement({ focus = false } = {}) {
        if (!this.active) return null;
        this.clearActiveClass();
        const activeEl = this.getActiveElement();
        if (activeEl) {
            activeEl.classList.add('move-mode-active');
            this.active.element = activeEl;
            if (focus) {
                activeEl.focus();
            }
        }
        return activeEl;
    }

    static setActive(nextState, focus) {
        this.clearActiveClass();
        this.active = nextState;
        if (this.active.element) {
            this.active.element.classList.add('move-mode-active');
            if (focus) {
                this.active.element.focus();
            }
        } else {
            this.refreshActiveElement({ focus });
        }
    }

    static clearActiveClass() {
        if (this.active && this.active.element) {
            this.active.element.classList.remove('move-mode-active');
            this.active.element = null;
        }
    }

    static getActiveElement() {
        if (!this.active) return null;

        if (this.active.type === 'item') {
            const config = ViewerConfig.getConfig(this.active.viewName);
            if (!config) return null;
            const content = document.getElementById(config.contentId);
            if (!content) return null;
            return content.querySelector(
                `.checklist-item[data-file-index="${this.active.fileIndex}"][data-item-index="${this.active.itemIndex}"]`
            );
        }

        if (this.active.type === 'file') {
            return document.querySelector(
                `.accordion-header[data-view="${this.active.viewName}"][data-file-index="${this.active.fileIndex}"]`
            );
        }

        return null;
    }
}

// Expose globally
window.MoveModeManager = MoveModeManager;
