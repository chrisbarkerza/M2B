/**
 * ChecklistParser - Transform between markdown format and internal item representation
 * Pure utility functions for parsing and formatting checklist items
 * Dependencies: None
 */
class ChecklistParser {
    /**
     * Parse markdown bullets into item objects
     * @param {string} markdown - Markdown content with bullets
     * @returns {Array} Array of item objects with text, checked, highlight, indent, collapseState properties
     */
    static parseCheckboxItems(markdown) {
        const lines = markdown.split('\n');
        const items = [];

        lines.forEach(line => {
            // Match both checkbox format: "- [ ] text" (legacy) and plain bullet format: "- text"
            // Also capture leading spaces for indentation
            const checkboxMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
            const bulletMatch = line.match(/^(\s*)- (.+)$/);

            if (checkboxMatch) {
                const indent = Math.floor(checkboxMatch[1].length / 2); // 2 spaces per indent
                const parsed = this.parseHighlight(checkboxMatch[3]);
                items.push({
                    text: parsed.text,
                    checked: false,
                    highlight: parsed.highlight,
                    collapseState: parsed.collapseState,
                    indent
                });
            } else if (bulletMatch) {
                const indent = Math.floor(bulletMatch[1].length / 2); // 2 spaces per indent
                const parsed = this.parseHighlight(bulletMatch[2]);
                items.push({
                    text: parsed.text,
                    checked: false,
                    highlight: parsed.highlight,
                    collapseState: parsed.collapseState,
                    indent
                });
            }
        });

        return items;
    }

    /**
     * Extract metadata from HTML comments
     * @param {string} text - Item text that may contain metadata comments
     * @returns {object} Object with text (without comments), highlight color, collapseState
     */
    static parseHighlight(text) {
        let remaining = text;
        let highlight = null;
        let collapseState = null;
        const commentRegex = /\s*<!--\s*([a-z:]+)\s*-->\s*$/i;
        let match = remaining.match(commentRegex);

        while (match) {
            const token = match[1].toLowerCase();
            if (token.startsWith('hl:') && !highlight) {
                highlight = token.slice(3);
            } else if ((token === 'collapsed' || token === 'expanded') && !collapseState) {
                collapseState = token;
            }
            remaining = remaining.replace(match[0], '').trimEnd();
            match = remaining.match(commentRegex);
        }

        return {
            text: remaining.trim(),
            highlight,
            collapseState
        };
    }

    /**
     * Convert item object back to markdown line
     * @param {object} item - Item with text, checked, highlight, indent properties
     * @returns {string} Formatted markdown line
     */
    static formatItemLine(item) {
        const highlightSuffix = item.highlight ? ` <!-- hl:${item.highlight} -->` : '';
        const collapseSuffix = item.collapseState ? ` <!-- ${item.collapseState} -->` : '';
        const indent = '  '.repeat(item.indent || 0); // 2 spaces per indent level
        return `${indent}- ${item.text}${highlightSuffix}${collapseSuffix}`;
    }

    /**
     * Ensure items with children have a collapse state, and items without children do not
     * @param {string} markdown - Markdown content
     * @param {Array} items - Optional parsed items to reuse
     * @returns {object} Object with updated content, items, and changed flag
     */
    static normalizeCollapseStates(markdown, items) {
        const parsedItems = items || this.parseCheckboxItems(markdown);
        let updatedContent = markdown;
        let changed = false;

        const updatedItems = parsedItems.map((item, index) => {
            const hasChildren = this.itemHasChildren(parsedItems, index);
            let collapseState = item.collapseState || null;

            if (hasChildren && !collapseState) {
                collapseState = 'expanded';
            } else if (!hasChildren && collapseState) {
                collapseState = null;
            }

            if (collapseState !== item.collapseState) {
                changed = true;
                const updatedItem = { ...item, collapseState };
                updatedContent = this.updateCheckboxLineByIndex(updatedContent, index, this.formatItemLine(updatedItem));
                return updatedItem;
            }

            return item;
        });

        return { content: updatedContent, items: updatedItems, changed };
    }

    /**
     * Check if an item has children (next items with deeper indent)
     * @param {Array} items - Array of items
     * @param {number} itemIndex - Index of current item
     * @returns {boolean} True if item has children
     */
    static itemHasChildren(items, itemIndex) {
        const current = items[itemIndex];
        if (!current) return false;
        const currentIndent = current.indent || 0;
        for (let i = itemIndex + 1; i < items.length; i++) {
            const nextIndent = items[i].indent || 0;
            if (nextIndent <= currentIndent) {
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Update a specific bullet line by index (counting bullet lines)
     * @param {string} sourceContent - Original markdown content
     * @param {number} targetIndex - Index of bullet to update (0-based)
     * @param {string} newLine - New line content
     * @returns {string} Updated markdown content
     */
    static updateCheckboxLineByIndex(sourceContent, targetIndex, newLine) {
        const lines = sourceContent.split('\n');
        let checkboxIndex = -1;
        const newLines = lines.map(line => {
            const match = line.match(/^(\s*)- (?:\[[ x]\] )?(.+)$/);
            if (!match) return line;
            checkboxIndex += 1;
            if (checkboxIndex === targetIndex) {
                return newLine;
            }
            return line;
        });
        return newLines.join('\n');
    }

    /**
     * Remove a specific bullet line by index
     * @param {string} sourceContent - Original markdown content
     * @param {number} targetIndex - Index of bullet to remove (0-based)
     * @returns {string} Updated markdown content
     */
    static removeCheckboxLineByIndex(sourceContent, targetIndex) {
        const lines = sourceContent.split('\n');
        let checkboxIndex = -1;
        const newLines = lines.filter(line => {
            const match = line.match(/^(\s*)- (?:\[[ x]\] )?(.+)$/);
            if (!match) return true;
            checkboxIndex += 1;
            return checkboxIndex !== targetIndex;
        });
        return newLines.join('\n');
    }

    /**
     * Reorder bullet lines to match new item order
     * @param {string} sourceContent - Original markdown content
     * @param {Array} uncheckedItems - Reordered array of unchecked items
     * @returns {string} Updated markdown content
     */
    static reorderUncheckedLines(sourceContent, uncheckedItems) {
        const lines = sourceContent.split('\n');
        let uncheckedIndex = 0;
        const newLines = lines.map(line => {
            const match = line.match(/^(\s*)- (?:\[[ x]\] )?(.+)$/);
            if (!match) return line;
            const item = uncheckedItems[uncheckedIndex];
            uncheckedIndex += 1;
            if (!item) return line;
            return this.formatItemLine({ ...item, checked: false });
        });
        return newLines.join('\n');
    }
}

// Expose globally
window.ChecklistParser = ChecklistParser;
