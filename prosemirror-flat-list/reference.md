# API Reference: prosemirror-flat-list

## Overview
This is the API reference documentation for prosemirror-flat-list, a ProseMirror extension for managing flat list structures.

## Functions

### findListsRange()
Returns a minimal block range encompassing two positions, representing one or multiple sibling list nodes.

**Signature:** `findListsRange($from: ResolvedPos, $to: ResolvedPos): NodeRange | null`

### isListNode()
Tests whether a given value is a list node.

**Signature:** `isListNode(node: Node | null | undefined): boolean`

### isListType()
Tests whether a given node type is a list type.

**Signature:** `isListType(type: NodeType): boolean`

### joinListElements()
Merges adjacent `<ul>` or `<ol>` elements into a single list element.

**Signature:** `joinListElements<T>(parent: T): T`

### migrateDocJSON()
Converts ProseMirror document JSON from the old list structure to the new format. Returns the updated object or `null` if no changes needed.

**Signature:** `migrateDocJSON(docJSON: ProsemirrorNodeJSON): ProsemirrorNodeJSON | null`

---

## Commands

### DedentListOptions
Options for dedenting lists:
- `from?`: number (default: `state.selection.from`)
- `to?`: number (default: `state.selection.to`)

### IndentListOptions
Options for indenting lists:
- `from?`: number (default: `state.selection.from`)
- `to?`: number (default: `state.selection.to`)

### ToggleCollapsedOptions
- `collapsed?`: boolean – Force collapsed state instead of toggling
- `isToggleable?`: (node: Node) => boolean – Predicate for toggleable nodes

### UnwrapListOptions
- `kind?`: string – Only unwrap this specific list kind

### WrapInListGetAttrs
Type for list attributes or callback: `T | (range: NodeRange) => T | null`

### backspaceCommand
Command for `Backspace` key. Chains:
- protectCollapsed
- deleteSelection
- joinListUp
- joinCollapsedListBackward
- joinTextblockBackward
- selectNodeBackward

### deleteCommand
Command for `Delete` key. Chains:
- protectCollapsed
- deleteSelection
- joinTextblockForward
- selectNodeForward

### enterCommand
Command for `Enter` key. Chains:
- protectCollapsed
- createSplitListCommand

### joinCollapsedListBackward
Moves the current block into the first child of a preceding collapsed list, skipping hidden content.

### joinListUp
At the start of a list's first child, lifts all content. At the start of the last child, lifts that child only.

### listKeymap
Returns a keymap object with:
- `Enter`: enterCommand
- `Backspace`: backspaceCommand
- `Delete`: deleteCommand
- `Mod-[`: Dedent (createDedentListCommand)
- `Mod-]`: Indent (createIndentListCommand)

### protectCollapsed
Prevents accidental deletion of collapsed items by expanding them instead.

### createDedentListCommand()
Returns a command decreasing indentation of selected list nodes.

**Signature:** `createDedentListCommand(options?: DedentListOptions): Command`

### createIndentListCommand()
Returns a command increasing indentation of selected list nodes.

**Signature:** `createIndentListCommand(options?: IndentListOptions): Command`

### createMoveListCommand()
Returns a command moving selected list nodes up or down.

**Signature:** `createMoveListCommand(direction: "up" | "down"): Command`

### createSplitListCommand()
Returns a command splitting the current list node.

**Signature:** `createSplitListCommand(): Command`

### createToggleCollapsedCommand()
Returns a command toggling the `collapsed` attribute of list nodes.

**Signature:** `createToggleCollapsedCommand(options: ToggleCollapsedOptions): Command`

### createToggleListCommand()
Wraps selection in a list, changes list kind, or unwraps existing list.

**Signature:** `createToggleListCommand<T>(attrs: T): Command`

### createUnwrapListCommand()
Returns a command unwrapping lists around the selection.

**Signature:** `createUnwrapListCommand(options?: UnwrapListOptions): Command`

### createWrapInListCommand()
Returns a command wrapping selection in a list with specified attributes.

**Signature:** `createWrapInListCommand<T>(getAttrs: WrapInListGetAttrs<T>): Command`

---

## Input Rules

### ListInputRuleAttributesGetter()
Callback type for obtaining list attributes: `(options: { attributes?: T; match: RegExpMatchArray }) => T`

### listInputRules
Constant array of `InputRule[]` for automatic list creation.

### wrappingListInputRule()
Builds an input rule for automatically wrapping text into a list when a pattern is typed.

**Signature:** `wrappingListInputRule<T>(regexp: RegExp, getAttrs: T | ListInputRuleAttributesGetter<T>): InputRule`

---

## Plugins

### ListDOMSerializer
Custom DOM serializer converting flat list nodes to native HTML `<ul>` and `<ol>` elements.

**Constructor:**
```
new ListDOMSerializer(
  nodes: { [node: string]: (node: Node) => DOMOutputSpec },
  marks: { [mark: string]: (mark: Mark, inline: boolean) => DOMOutputSpec }
)
```

**Methods:**
- `serializeFragment(fragment: Fragment, options?: { document?: Document }, target?: HTMLElement | DocumentFragment)`
- `static fromSchema(schema: Schema): ListDOMSerializer`
- `static nodesFromSchema(schema: Schema): { [node: string]: (node: Node) => DOMOutputSpec }`

### createListNodeView
Simple node view ensuring list nodes update when marker styling changes.

### createListClipboardPlugin()
Serializes list nodes to native HTML for clipboard operations.

**Signature:** `createListClipboardPlugin(schema: Schema): Plugin`

### createListEventPlugin()
Handles DOM events for lists.

**Signature:** `createListEventPlugin(): Plugin`

### createListPlugins()
Returns array of required plugins:
- createListEventPlugin
- createListRenderingPlugin
- createListClipboardPlugin
- createSafariInputMethodWorkaroundPlugin

**Signature:** `createListPlugins(options: { schema: Schema }): Plugin[]`

### createListRenderingPlugin()
Handles list node rendering.

**Signature:** `createListRenderingPlugin(): Plugin`

### createSafariInputMethodWorkaroundPlugin()
Workaround for Safari bug causing composition-based IME to remove empty elements with `position: relative`.

**Signature:** `createSafariInputMethodWorkaroundPlugin(): Plugin`

---

## Schema

### ListAttributes
- `checked?`: boolean
- `collapsed?`: boolean
- `kind?`: string
- `order?`: number | null

### ListToDOMOptions
- `getAttributes?`: (node: Node) => Record<string, string | undefined>
- `getMarkers?`: (node: Node) => DOMOutputSpec[] | null
- `nativeList?`: boolean (default: false)
- `node`: Node

### ProsemirrorNodeJSON
- `attrs?`: Attrs
- `content?`: ProsemirrorNodeJSON[]
- `marks?`: (string | { attrs?: Attrs; type: string })[]
- `text?`: string
- `type`: string

### ListKind
Type: `"bullet" | "ordered" | "task" | "toggle"`

### createListSpec()
Returns the NodeSpec for list nodes.

**Signature:** `createListSpec(): NodeSpec`

### createParseDomRules()
Returns parsing rules for converting HTML to ProseMirror list nodes.

**Signature:** `createParseDomRules(): readonly TagParseRule[]`

### listToDOM()
Renders a list node to DOM output specification.

**Signature:** `listToDOM(options: ListToDOMOptions): DOMOutputSpec`
