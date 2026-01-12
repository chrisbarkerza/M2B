/**
 * ProseMirror Bundle
 * Bundles all ProseMirror modules and exposes them to window.PM
 */

import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { inputRules } from 'prosemirror-inputrules';
import {
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
} from 'prosemirror-flat-list';

// Expose to window for non-module scripts
window.PM = {
    model: { Schema },
    state: { EditorState },
    view: { EditorView },
    keymap: { keymap },
    inputrules: { inputRules }
};

window.ProseMirrorFlatList = {
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
};

console.log('✅ ProseMirror bundle loaded');
