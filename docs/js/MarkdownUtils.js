/**
 * MarkdownUtils - Markdown to HTML conversion
 * Basic markdown rendering for file viewer
 * Dependencies: None
 */
class MarkdownUtils {
    static extractHeaderMetadata(markdown) {
        const head = markdown.split('\n').slice(0, 5).join('\n');
        const idMatch = head.match(/<!--\s*id:\s*([A-Za-z0-9-]+)\s*-->/);
        const orderMatch = head.match(/<!--\s*order:\s*([A-Za-z0-9-]+)\s*-->/);
        return {
            id: idMatch ? idMatch[1] : null,
            order: orderMatch ? orderMatch[1] : null
        };
    }

    static generateFileId() {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    static ensureFileId(markdown) {
        const metadata = this.extractHeaderMetadata(markdown);
        const id = metadata.id || this.generateFileId();
        const content = this.upsertHeaderComment(markdown, 'id', id, 0);
        const changed = content !== markdown;
        return { content, id, changed };
    }

    static upsertHeaderComment(markdown, key, value, preferredIndex = 0) {
        const lines = markdown.split('\n');
        const pattern = new RegExp(`<!--\\s*${key}\\s*:[^>]*-->`);
        for (let i = lines.length - 1; i >= 0; i--) {
            if (!pattern.test(lines[i])) continue;
            const cleaned = lines[i].replace(pattern, '').trimEnd();
            if (cleaned === '') {
                lines.splice(i, 1);
            } else {
                lines[i] = cleaned;
            }
        }

        const insertAt = Math.min(Math.max(preferredIndex, 0), lines.length);
        lines.splice(insertAt, 0, `<!-- ${key}:${value} -->`);
        return lines.join('\n');
    }

    static setOrderKey(markdown, orderKey) {
        const metadata = this.extractHeaderMetadata(markdown);
        const preferredIndex = metadata.id ? 1 : 0;
        return this.upsertHeaderComment(markdown, 'order', orderKey, preferredIndex);
    }

    static generateOrderKeyBetween(prevKey, nextKey) {
        const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
        const minChar = digits[0];
        const maxChar = digits[digits.length - 1];
        const a = prevKey || '';
        const b = nextKey || '';
        let prefix = '';
        let i = 0;

        while (true) {
            const aChar = i < a.length ? a[i] : minChar;
            const bChar = i < b.length ? b[i] : maxChar;

            if (aChar === bChar) {
                prefix += aChar;
                i += 1;
                continue;
            }

            const aIndex = digits.indexOf(aChar);
            const bIndex = digits.indexOf(bChar);
            if (aIndex === -1 || bIndex === -1) {
                return `${a}a`;
            }

            if (bIndex - aIndex > 1) {
                const midIndex = Math.floor((aIndex + bIndex) / 2);
                return prefix + digits[midIndex];
            }

            prefix += aChar;
            i += 1;
        }
    }

    static generateOrderKeyForIndex(index) {
        return index.toString(36).padStart(3, '0');
    }
    /**
     * Convert markdown to HTML (basic conversion)
     * @param {string} markdown - Markdown content
     * @returns {string} HTML content
     */
    static markdownToHtml(markdown) {
        // Basic markdown to HTML conversion
        let html = markdown;

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

        // Legacy checkboxes -> bullets
        html = html.replace(/- \[[ x]\] (.*$)/gim, '- $1');

        // Lists
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');

        // Line breaks
        html = html.replace(/\n/gim, '<br>');

        return html;
    }
}

// Expose globally
window.MarkdownUtils = MarkdownUtils;
