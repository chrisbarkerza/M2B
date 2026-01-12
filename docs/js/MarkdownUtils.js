/**
 * MarkdownUtils - Markdown to HTML conversion
 * Basic markdown rendering for file viewer
 * Dependencies: None
 */
class MarkdownUtils {
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
