/**
 * HighlightMenu - Context menu for color-coding items
 * Manages the popup menu for applying highlights and item actions
 * Dependencies: AppState, ItemActions
 */
class HighlightMenu {
    static highlightMenu = null;
    static highlightMenuJustOpened = false;

    /**
     * Ensure highlight menu exists in DOM
     * @returns {HTMLElement} The menu element
     */
    static ensureHighlightMenu() {
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
                ItemActions.applyHighlight(viewName, fileIndex, itemIndex, color);
                this.hideHighlightMenu();
            }
            // Handle action buttons
            else if (button.dataset.action) {
                const action = button.dataset.action;
                this.hideHighlightMenu();

                if (action === 'done') {
                    ItemActions.completeItem(viewName, fileIndex, itemIndex);
                } else if (action === 'indent') {
                    ItemActions.indentItem(viewName, fileIndex, itemIndex);
                } else if (action === 'outdent') {
                    ItemActions.outdentItem(viewName, fileIndex, itemIndex);
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
    }

    /**
     * Show highlight menu at item position
     * @param {HTMLElement} itemEl - Item element
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     * @param {number} itemIndex - Item index
     */
    static showHighlightMenu(itemEl, viewName, fileIndex, itemIndex) {
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
    }

    /**
     * Hide the highlight menu
     */
    static hideHighlightMenu() {
        if (!this.highlightMenu) return;
        this.highlightMenu.classList.add('hidden');
    }
}

// Expose globally
window.HighlightMenu = HighlightMenu;
