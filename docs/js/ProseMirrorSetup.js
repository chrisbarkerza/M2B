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
     * Create a ProseMirror editor instance
     * @param {HTMLElement} element - DOM element to mount editor
     * @param {Object} docJSON - ProseMirror document JSON
     * @param {Function} onChange - Callback when document changes
     * @returns {EditorView} ProseMirror editor view instance
     */
    function createEditor(element, docJSON, onChange) {
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
