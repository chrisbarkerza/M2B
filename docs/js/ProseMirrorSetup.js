/**
 * ProseMirrorSetup - Configuration for ProseMirror editor with flat-list support
 * Provides schema, plugins, and commands for task list editing
 * Dependencies: ProseMirror libraries (loaded via CDN)
 */

const ProseMirrorSetup = (() => {
    // ProseMirror libraries from unpkg expose as window.PM
    const PM = window.PM;

    if (!PM) {
        console.error('ProseMirror (window.PM) not loaded. Check CDN scripts.');
        return null;
    }

    // Access ProseMirror modules
    const { Schema } = PM.model;
    const { EditorState } = PM.state;
    const { EditorView } = PM.view;
    const { keymap } = PM.keymap;
    const { inputRules } = PM.inputrules;

    // Access prosemirror-flat-list
    const flatList = window.ProseMirrorFlatList;

    if (!flatList) {
        console.error('prosemirror-flat-list not loaded. Check CDN script.');
        return null;
    }

    const {
        createListSpec,
        createListPlugins,
        listInputRules,
        listKeymap,
        createIndentListCommand,
        createDedentListCommand,
        createMoveListCommand,
        createToggleListCommand,
        createSplitListCommand,
        enterCommand,
        backspaceCommand,
        deleteCommand
    } = flatList;

    // Create schema with list support
    const schema = new Schema({
        nodes: {
            doc: {
                content: 'block+'
            },
            paragraph: {
                content: 'text*',
                group: 'block',
                parseDOM: [{ tag: 'p' }],
                toDOM() { return ['p', 0]; }
            },
            text: {
                group: 'inline'
            },
            list: createListSpec()
        },
        marks: {}
    });

    /**
     * Create custom keymap with Cmd-Shift-Arrow bindings
     */
    const customKeymap = keymap({
        // Standard ProseMirror list bindings
        'Enter': enterCommand,
        'Backspace': backspaceCommand,
        'Delete': deleteCommand,
        'Mod-]': createIndentListCommand(),
        'Mod-[': createDedentListCommand(),
        'Tab': createIndentListCommand(),
        'Shift-Tab': createDedentListCommand(),

        // Custom Cmd-Shift-Arrow bindings for moving items
        'Mod-Shift-ArrowUp': createMoveListCommand('up'),
        'Mod-Shift-ArrowDown': createMoveListCommand('down'),
        'Mod-Shift-ArrowRight': createIndentListCommand(),
        'Mod-Shift-ArrowLeft': createDedentListCommand()
    });

    /**
     * Attach gesture handlers to editor DOM for long-press context menu
     * @param {EditorView} view - ProseMirror editor view
     * @param {string} viewName - View name
     * @param {number} fileIndex - File index
     */
    function attachGestureHandlers(view, viewName, fileIndex) {
        let gestureState = null;

        const handlePointerDown = (event) => {
            // Check if clicking on a list item element (DOM level)
            const listItem = event.target.closest('[data-list-kind]');
            if (!listItem) {
                console.log('[ProseMirror] Pointerdown but not on list item');
                return;
            }
            console.log('[ProseMirror] Pointerdown on list item, starting gesture');

            // Don't start gesture if clicking on checkbox area
            const rect = listItem.getBoundingClientRect();
            const relativeX = event.clientX - rect.left;
            if (relativeX < 30) return; // Skip checkbox area (left 30px)

            // Find the list item node position
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!pos) return;

            // Start gesture tracking
            gestureState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                longPressTriggered: false,
                pos: pos.pos,
                targetEl: listItem,
                longPressTimer: null
            };

            gestureState.longPressTimer = window.setTimeout(() => {
                console.log('[ProseMirror] Long press triggered!');
                gestureState.longPressTriggered = true;
                // Visual feedback
                listItem.style.backgroundColor = 'rgba(var(--primary-color-rgb, 59, 130, 246), 0.1)';
            }, 500);
        };

        const handlePointerMove = (event) => {
            if (!gestureState || gestureState.pointerId !== event.pointerId) return;

            const dx = event.clientX - gestureState.startX;
            const dy = event.clientY - gestureState.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Cancel long press if moved too much
            if (distance > 10) {
                window.clearTimeout(gestureState.longPressTimer);
                if (gestureState.targetEl) {
                    gestureState.targetEl.style.backgroundColor = '';
                }
                gestureState = null;
            }
        };

        const handlePointerUp = (event) => {
            if (!gestureState || gestureState.pointerId !== event.pointerId) return;

            window.clearTimeout(gestureState.longPressTimer);

            // Clear visual feedback
            if (gestureState.targetEl) {
                gestureState.targetEl.style.backgroundColor = '';
            }

            if (gestureState.longPressTriggered) {
                console.log('[ProseMirror] Showing context menu', {
                    hasTargetEl: !!gestureState.targetEl,
                    hasHighlightMenu: !!window.HighlightMenu,
                    viewName,
                    fileIndex
                });
                // Show context menu
                // Note: The cursor is already at the position where the user long-pressed
                if (gestureState.targetEl && window.HighlightMenu) {
                    // Pass -1 as itemIndex since we don't use the old items array anymore
                    window.HighlightMenu.showHighlightMenu(gestureState.targetEl, viewName, fileIndex, -1);
                } else {
                    console.error('[ProseMirror] Cannot show menu - missing targetEl or HighlightMenu');
                }

                gestureState = null;
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            gestureState = null;
        };

        const handlePointerCancel = (event) => {
            if (gestureState) {
                window.clearTimeout(gestureState.longPressTimer);
                if (gestureState.targetEl) {
                    gestureState.targetEl.style.backgroundColor = '';
                }
                gestureState = null;
            }
        };

        // Attach event listeners to the editor DOM
        view.dom.addEventListener('pointerdown', handlePointerDown);
        view.dom.addEventListener('pointermove', handlePointerMove);
        view.dom.addEventListener('pointerup', handlePointerUp);
        view.dom.addEventListener('pointercancel', handlePointerCancel);
    }

    /**
     * Create a ProseMirror editor instance
     * @param {HTMLElement} element - DOM element to mount editor
     * @param {Object} docJSON - ProseMirror document JSON
     * @param {Function} onChange - Callback when document changes
     * @param {string} viewName - View name for gesture handling
     * @param {number} fileIndex - File index for gesture handling
     * @returns {EditorView} ProseMirror editor view instance
     */
    function createEditor(element, docJSON, onChange, viewName, fileIndex) {
        // Parse JSON to ProseMirror document
        const doc = schema.nodeFromJSON(docJSON);

        // Create editor state
        const state = EditorState.create({
            doc,
            plugins: [
                ...createListPlugins({ schema }),
                inputRules({ rules: listInputRules }),
                customKeymap
            ]
        });

        // Create and mount editor view
        const view = new EditorView(element, {
            state,
            dispatchTransaction(transaction) {
                const newState = view.state.apply(transaction);
                view.updateState(newState);

                // Call onChange callback if document changed
                if (transaction.docChanged && onChange) {
                    onChange(newState.doc.toJSON());
                }
            }
        });

        // Prevent browser context menu on the ProseMirror editor
        view.dom.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            return false;
        });

        // Attach gesture handlers for long-press context menu
        if (viewName !== undefined && fileIndex !== undefined) {
            attachGestureHandlers(view, viewName, fileIndex);
        }

        return view;
    }

    /**
     * Create an empty ProseMirror document with a task list
     * @returns {Object} Empty document JSON
     */
    function createEmptyDoc() {
        return {
            type: 'doc',
            content: [{
                type: 'list',
                attrs: {
                    kind: 'task',
                    checked: null,
                    collapsed: null,
                    order: null
                },
                content: []
            }]
        };
    }

    /**
     * Create a task list item
     * @param {string} text - Item text content
     * @param {boolean} checked - Whether the task is checked
     * @returns {Object} List item JSON
     */
    function createTaskItem(text, checked = false) {
        return {
            type: 'list',
            attrs: {
                kind: 'task',
                checked: checked,
                collapsed: null,
                order: null
            },
            content: [{
                type: 'paragraph',
                content: text ? [{ type: 'text', text }] : []
            }]
        };
    }

    /**
     * Extract plain text from a ProseMirror document for search
     * @param {Object} docJSON - ProseMirror document JSON
     * @returns {string} Plain text content
     */
    function extractText(docJSON) {
        let text = '';

        function traverse(node) {
            if (node.type === 'text') {
                text += node.text + ' ';
            } else if (node.content) {
                node.content.forEach(traverse);
            }
        }

        traverse(docJSON);
        return text.trim();
    }

    // Expose public API
    return {
        schema,
        createEditor,
        createEmptyDoc,
        createTaskItem,
        extractText,
        // Export commands for external use
        commands: {
            indent: createIndentListCommand,
            dedent: createDedentListCommand,
            moveUp: () => createMoveListCommand('up'),
            moveDown: () => createMoveListCommand('down'),
            toggleList: createToggleListCommand,
            split: createSplitListCommand
        }
    };
})();

// Expose globally
window.ProseMirrorSetup = ProseMirrorSetup;

// Debug: Log status
if (window.ProseMirrorSetup) {
    console.log('✅ ProseMirrorSetup initialized successfully');
} else {
    console.error('❌ ProseMirrorSetup failed to initialize');
}
