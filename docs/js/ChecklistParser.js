/**
 * ChecklistParser - Transform between markdown format and internal item representation
 * Pure utility functions for parsing and formatting checklist items
 * Dependencies: None
 */
class ChecklistParser {
    /**
     * Parse markdown checkboxes and bullets into item objects
     * @param {string} markdown - Markdown content with checkboxes
     * @returns {Array} Array of item objects with text, checked, highlight, indent properties
     */
    static parseCheckboxItems(markdown) {
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
    }

    /**
     * Extract highlight color from HTML comment
     * @param {string} text - Item text that may contain highlight comment
     * @returns {object} Object with text (without comment) and highlight color
     */
    static parseHighlight(text) {
        const match = text.match(/\s*<!--\s*hl:([a-z]+)\s*-->\s*$/i);
        if (!match) return { text, highlight: null };
        return {
            text: text.replace(match[0], '').trim(),
            highlight: match[1].toLowerCase()
        };
    }

    /**
     * Convert item object back to markdown line
     * @param {object} item - Item with text, checked, highlight, indent properties
     * @returns {string} Formatted markdown line
     */
    static formatItemLine(item) {
        const highlightSuffix = item.highlight ? ` <!-- hl:${item.highlight} -->` : '';
        const indent = '  '.repeat(item.indent || 0); // 2 spaces per indent level
        const checkMark = item.checked ? 'x' : ' ';
        return `${indent}- [${checkMark}] ${item.text}${highlightSuffix}`;
    }

    /**
     * Update a specific checkbox line by index (counting only checkbox lines)
     * @param {string} sourceContent - Original markdown content
     * @param {number} targetIndex - Index of checkbox to update (0-based)
     * @param {string} newLine - New line content
     * @returns {string} Updated markdown content
     */
    static updateCheckboxLineByIndex(sourceContent, targetIndex, newLine) {
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
    }

    /**
     * Remove a specific checkbox line by index
     * @param {string} sourceContent - Original markdown content
     * @param {number} targetIndex - Index of checkbox to remove (0-based)
     * @returns {string} Updated markdown content
     */
    static removeCheckboxLineByIndex(sourceContent, targetIndex) {
        const lines = sourceContent.split('\n');
        let checkboxIndex = -1;
        const newLines = lines.filter(line => {
            const match = line.match(/^(\s*)- \[([ x])\] (.+)$/);
            if (!match) return true;
            checkboxIndex += 1;
            return checkboxIndex !== targetIndex;
        });
        return newLines.join('\n');
    }

    /**
     * Reorder unchecked checkbox lines to match new item order
     * @param {string} sourceContent - Original markdown content
     * @param {Array} uncheckedItems - Reordered array of unchecked items
     * @returns {string} Updated markdown content
     */
    static reorderUncheckedLines(sourceContent, uncheckedItems) {
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
    }
}

// Expose globally
window.ChecklistParser = ChecklistParser;
