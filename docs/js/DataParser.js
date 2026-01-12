/**
 * DataParser - Parse markdown files with frontmatter
 * Utility functions for parsing structured markdown content
 * Dependencies: None
 */
class DataParser {
    static parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) return { frontmatter: {}, content };

        const frontmatter = {};
        const lines = match[1].split('\n');
        lines.forEach(line => {
            const [key, ...values] = line.split(':');
            if (key && values.length) {
                frontmatter[key.trim()] = values.join(':').trim();
            }
        });

        return { frontmatter, content: match[2] };
    }

    static parseShoppingList(content) {
        const sections = { Supplements: [], Pharmacy: [], Food: [] };
        let currentSection = null;

        content.split('\n').forEach(line => {
            const sectionMatch = line.match(/^## (.+)$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                if (!sections[currentSection]) {
                    sections[currentSection] = [];
                }
                return;
            }

            const itemMatch = line.match(/^- \[([ x])\] (.+)$/);
            if (itemMatch && currentSection) {
                sections[currentSection].push({
                    checked: itemMatch[1] === 'x',
                    text: itemMatch[2]
                });
            }
        });

        return { sections };
    }

    static parseTaskList(content) {
        const { frontmatter, content: body } = this.parseFrontmatter(content);
        const tasks = { active: [], completed: [] };
        let currentSection = 'active';

        body.split('\n').forEach(line => {
            if (line.includes('## Active')) {
                currentSection = 'active';
                return;
            }
            if (line.includes('## Completed')) {
                currentSection = 'completed';
                return;
            }

            const taskMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)$/);
            if (taskMatch) {
                const dueMatch = taskMatch[3].match(/\(due: ([^)]+)\)/);
                const confidenceMatch = taskMatch[3].match(/\[confidence: (\d+)\]/);
                const priorityMatch = taskMatch[3].match(/\[priority: (\w+)\]/);
                const orderMatch = taskMatch[3].match(/\[order: (\d+)\]/);
                const projectMatch = taskMatch[3].match(/\[project: ([^\]]+)\]/);

                tasks[currentSection].push({
                    checked: taskMatch[1] === 'x',
                    text: taskMatch[2],
                    due: dueMatch ? dueMatch[1] : null,
                    confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : null,
                    priority: priorityMatch ? priorityMatch[1] : 'medium',
                    order: orderMatch ? parseInt(orderMatch[1]) : 999,
                    project: projectMatch ? projectMatch[1] : null,
                    raw: line
                });
            }
        });

        return { frontmatter, tasks };
    }
}

// Expose globally
window.DataParser = DataParser;
