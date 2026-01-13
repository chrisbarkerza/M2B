/**
 * Viewer - Shared accordion viewer for list-based tabs
 * Coordinates view loading and delegates to specialized modules
 * Dependencies: ViewerConfig, ChecklistParser, ViewRenderer, ItemEditor, ItemActions,
 *               GestureHandler, DragReorder, HighlightMenu, LocalStorageManager, SyncManager
 */
const Viewer = {
    /**
     * Check if viewName is a valid view
     * @param {string} viewName - View name to check
     * @returns {boolean} True if valid view
     */
    isView(viewName) {
        return ViewerConfig.isView(viewName);
    },

    /**
     * Load view data from local storage or GitHub
     * @param {string} viewName - View name (tasks, projects, notes, shopping, ideas, people)
     */
    async load(viewName) {
        const config = ViewerConfig.getConfig(viewName);
        if (!config) return;

        const content = document.getElementById(config.contentId);
        if (!content) return;
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            // Try to load from local storage first
            const localFiles = await LocalStorageManager.getAllFiles(config.directory);

            if (localFiles.length === 0) {
                // First load: fetch from GitHub
                console.log(`No local files for ${viewName}, loading from GitHub...`);
                await SyncManager.loadAllFromGitHub(viewName);

                // Try again after loading from GitHub
                const refreshedFiles = await LocalStorageManager.getAllFiles(config.directory);
                if (refreshedFiles.length === 0) {
                    content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                    return;
                }
                localFiles.push(...refreshedFiles);
            }

            // Filter out Done.md
            const files = localFiles.filter(f =>
                !f.path.endsWith('Done.md')
            );

            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">${config.emptyMessage}</div>`;
                return;
            }

            // Parse files from local storage using ChecklistParser
            const filesData = [];
            for (const file of files) {
                let content = file.content;
                const ensured = MarkdownUtils.ensureFileId(content);
                if (ensured.changed) {
                    content = ensured.content;
                    await LocalStorageManager.saveFile(file.path, content, true, file.githubSHA);
                }

                let items = ChecklistParser.parseCheckboxItems(content);
                if (items.length === 0) {
                    const placeholderLine = ChecklistParser.formatItemLine({
                        text: ' ',
                        checked: false,
                        highlight: null,
                        indent: 0
                    });
                    const trimmedContent = content.replace(/\s+$/, '');
                    content = trimmedContent.length ? `${trimmedContent}\n${placeholderLine}\n` : `${placeholderLine}\n`;
                    await FileUpdateManager.updateSourceFile(file.path, content, 'Add placeholder item', null);
                    items = ChecklistParser.parseCheckboxItems(content);
                }
                const normalized = ChecklistParser.normalizeCollapseStates(content, items);
                if (normalized.changed) {
                    await FileUpdateManager.updateSourceFile(file.path, normalized.content, 'Normalize collapse state', null);
                    items = normalized.items;
                }
                const metadata = MarkdownUtils.extractHeaderMetadata(content);
                filesData.push({
                    name: file.path.split('/').pop().replace('.md', ''),
                    path: file.path,
                    id: metadata.id,
                    orderKey: metadata.order,
                    highlight: metadata.highlight,
                    items,
                    expanded: false
                });
            }

            filesData.sort((a, b) => {
                const aOrder = a.orderKey;
                const bOrder = b.orderKey;
                if (aOrder && bOrder) {
                    const orderCompare = aOrder.localeCompare(bOrder);
                    if (orderCompare !== 0) return orderCompare;
                } else if (aOrder) {
                    return -1;
                } else if (bOrder) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });

            AppState.data[viewName] = { directory: config.directory, files: filesData };
            ViewRenderer.render(viewName);
        } catch (error) {
            content.innerHTML = `<div class="error">Error loading: ${error.message}</div>`;
        }
    },

    /**
     * Update source file (save to local storage)
     * @param {string} path - File path
     * @param {string} content - New content
     * @param {string} message - Commit message (for future use)
     * @param {string} toastMessage - Toast notification message
     */
    async updateSourceFile(path, content, message, toastMessage) {
        await FileUpdateManager.updateSourceFile(path, content, message, toastMessage);
    },

    // Expose module methods for backward compatibility
    render: ViewRenderer.render.bind(ViewRenderer),
    toggleAccordion: ViewRenderer.toggleAccordion.bind(ViewRenderer),
    parseCheckboxItems: ChecklistParser.parseCheckboxItems.bind(ChecklistParser),
    parseHighlight: ChecklistParser.parseHighlight.bind(ChecklistParser),
    formatItemLine: ChecklistParser.formatItemLine.bind(ChecklistParser),
    updateCheckboxLineByIndex: ChecklistParser.updateCheckboxLineByIndex.bind(ChecklistParser),
    removeCheckboxLineByIndex: ChecklistParser.removeCheckboxLineByIndex.bind(ChecklistParser),
    reorderUncheckedLines: ChecklistParser.reorderUncheckedLines.bind(ChecklistParser),
    startInlineEdit: ItemEditor.startInlineEdit.bind(ItemEditor),
    updateItemText: ItemEditor.updateItemText.bind(ItemEditor),
    insertNewBullet: ItemEditor.insertNewBullet.bind(ItemEditor),
    completeItem: ItemActions.completeItem.bind(ItemActions),
    moveItemToDone: ItemActions.moveItemToDone.bind(ItemActions),
    indentItem: ItemActions.indentItem.bind(ItemActions),
    outdentItem: ItemActions.outdentItem.bind(ItemActions),
    applyHighlight: ItemActions.applyHighlight.bind(ItemActions),
    getItemChildren: ItemActions.getItemChildren.bind(ItemActions),
    getItemWithChildren: ItemActions.getItemWithChildren.bind(ItemActions),
    bindInteractions: GestureHandler.bindInteractions.bind(GestureHandler),
    handleKeyDown: GestureHandler.handleKeyDown.bind(GestureHandler),
    handlePointerDown: GestureHandler.handlePointerDown.bind(GestureHandler),
    handlePointerMove: GestureHandler.handlePointerMove.bind(GestureHandler),
    handlePointerUp: GestureHandler.handlePointerUp.bind(GestureHandler),
    handlePointerCancel: GestureHandler.handlePointerCancel.bind(GestureHandler),
    resetGestureState: GestureHandler.resetGestureState.bind(GestureHandler),
    isGestureTargetValid: GestureHandler.isGestureTargetValid.bind(GestureHandler),
    findPreviousItemIndex: GestureHandler.findPreviousItemIndex.bind(GestureHandler),
    findNextItemIndex: GestureHandler.findNextItemIndex.bind(GestureHandler),
    startDrag: DragReorder.startDrag.bind(DragReorder),
    updateDragPosition: DragReorder.updateDragPosition.bind(DragReorder),
    finishDrag: DragReorder.finishDrag.bind(DragReorder),
    cleanupDrag: DragReorder.cleanupDrag.bind(DragReorder),
    reorderItems: DragReorder.reorderItems.bind(DragReorder),
    moveItemToFile: DragReorder.moveItemToFile.bind(DragReorder),
    ensureHighlightMenu: HighlightMenu.ensureHighlightMenu.bind(HighlightMenu),
    showHighlightMenu: HighlightMenu.showHighlightMenu.bind(HighlightMenu),
    hideHighlightMenu: HighlightMenu.hideHighlightMenu.bind(HighlightMenu)
};

window.Viewer = Viewer;
