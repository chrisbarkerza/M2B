/**
 * Shared accordion viewer for list-based tabs.
 */
const Viewer = {
    config: {
        tasks: {
            directory: 'md/ToDo',
            contentId: 'tasksContent',
            emptyMessage: 'No files found'
        },
        projects: {
            directory: 'md/Projects',
            contentId: 'projectsContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        notes: {
            directory: 'md/Notes',
            contentId: 'notesContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        shopping: {
            directory: 'md/Shopping',
            contentId: 'shoppingContent',
            emptyMessage: 'No files found. Use the + button to create new files.'
        },
        ideas: {
            directory: 'md/Ideas',
            contentId: 'ideasContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        },
        people: {
            directory: 'md/People',
            contentId: 'peopleContent',
            emptyMessage: 'No files found. Add markdown files to get started.'
        }
    },

    isView(viewName) {
        return Boolean(this.config[viewName]);
    },

    async load(viewName) {
        const config = this.config[viewName];
        if (!config) return;

        const content = document.getElementById(config.contentId);
        if (!content) return;
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const api = new GitHubAPI(AppState.token, AppState.repo);
            const contents = await api.request(`/contents/${config.directory}`, 'GET', null, true);

            if (!contents) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            const files = contents.filter(item =>
                item.type === 'file' &&
                item.name.endsWith('.md') &&
                item.name !== 'Done.md'
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            const filesData = await Promise.all(files.map(async file => {
                try {
                    const fileContent = await api.getFile(file.path);
                    const items = this.parseCheckboxItems(fileContent);
                    return {
                        name: file.name.replace('.md', ''),
                        path: file.path,
                        items: items,
                        expanded: false
                    };
                } catch (error) {
                    console.error(`Error loading ${file.name}:`, error);
                    return null;
                }
            }));

            const validFiles = filesData.filter(f => f !== null);

            AppState.data[viewName] = { directory: config.directory, files: validFiles };
            this.render(viewName);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    },

    parseCheckboxItems(markdown) {
        const lines = markdown.split('\n');
        const items = [];

        lines.forEach(line => {
            const uncheckedMatch = line.match(/^- \[ \] (.+)$/);
            const checkedMatch = line.match(/^- \[x\] (.+)$/);

            if (uncheckedMatch) {
                items.push({ text: uncheckedMatch[1], checked: false });
            } else if (checkedMatch) {
                items.push({ text: checkedMatch[1], checked: true });
            }
        });

        return items;
    },

    render(viewName) {
        const config = this.config[viewName];
        if (!config) return;

        const content = document.getElementById(config.contentId);
        const data = AppState.data[viewName];

        if (!data || !data.files || data.files.length === 0) {
            content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
            return;
        }

        let html = '<div class="accordion">';

        data.files.forEach((file, fileIndex) => {
            const expandedClass = file.expanded ? 'expanded' : '';
            const itemCount = file.items.filter(i => !i.checked).length;

            html += `<div class="accordion-item ${expandedClass}" data-file-index="${fileIndex}">`;
            html += `<div class="accordion-header" onclick="Viewer.toggleAccordion('${viewName}', ${fileIndex})">`;
            html += `<span class="accordion-icon">&#9654;</span>`;
            html += `<span>${file.name}</span>`;
            html += `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-light);">(${itemCount})</span>`;
            html += `</div>`;
            html += `<div class="accordion-content">`;
            html += `<div class="checklist">`;

            file.items.forEach((item, itemIndex) => {
                if (!item.checked) {
                    html += `
                        <label class="checklist-item">
                            <input
                                type="checkbox"
                                data-view="${viewName}"
                                data-file-index="${fileIndex}"
                                data-item-index="${itemIndex}"
                                onchange="Viewer.toggleAccordionItem(this)"
                            >
                            <span class="checklist-text">${item.text}</span>
                        </label>
                    `;
                }
            });

            html += `</div></div></div>`;
        });

        html += '</div>';
        content.innerHTML = html;
    },

    toggleAccordion(viewName, fileIndex) {
        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;
        data.files[fileIndex].expanded = !data.files[fileIndex].expanded;
        this.render(viewName);
    },

    async toggleAccordionItem(checkbox) {
        const viewName = checkbox.dataset.view;
        const fileIndex = parseInt(checkbox.dataset.fileIndex, 10);
        const itemIndex = parseInt(checkbox.dataset.itemIndex, 10);

        const data = AppState.data[viewName];
        if (!data || !data.files || !data.files[fileIndex]) return;

        const file = data.files[fileIndex];
        const item = file.items[itemIndex];

        item.checked = true;
        await this.moveItemToDone(viewName, data.directory, file, item);
        this.render(viewName);
    },

    async moveItemToDone(viewName, directory, file, item) {
        const today = new Date().toISOString().split('T')[0];
        const api = new GitHubAPI(AppState.token, AppState.repo);

        try {
            let doneContent = '';
            const donePath = `${directory}/Done.md`;
            try {
                doneContent = await api.getFile(donePath);
            } catch (error) {
                doneContent = `# ${directory.split('/').pop()} - Completed\n\n<!-- Checked items moved here with completion dates -->\n\n`;
            }

            doneContent += `- [x] [${file.name}] ${item.text} _(${today})_\n`;

            const sourceContent = await api.getFile(file.path);
            const lines = sourceContent.split('\n');
            const newLines = lines.filter(line => {
                const match = line.match(/^- \[ \] (.+)$/);
                return !match || match[1] !== item.text;
            });
            const newSourceContent = newLines.join('\n');

            if (AppState.isOnline) {
                await api.updateFile(donePath, doneContent, `Archive: ${item.text}`);
                await api.updateFile(file.path, newSourceContent, `Remove completed: ${item.text}`);
                if (window.UI && UI.showToast) {
                    UI.showToast('Moved to Done', 'success');
                }
            } else {
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: { path: donePath, content: doneContent, message: 'Archive item (offline)' },
                    description: 'Archive update'
                });
                await QueueManager.enqueue({
                    type: 'update_file',
                    data: { path: file.path, content: newSourceContent, message: 'Remove item (offline)' },
                    description: 'File update'
                });
                if (window.UI && UI.showToast) {
                    UI.showToast('Queued for sync', 'info');
                }
            }

            file.items = file.items.filter(i => i !== item);
        } catch (error) {
            if (window.UI && UI.showToast) {
                UI.showToast('Failed to move item: ' + error.message, 'error');
            }
            item.checked = false;
        }
    }
};

window.Viewer = Viewer;
