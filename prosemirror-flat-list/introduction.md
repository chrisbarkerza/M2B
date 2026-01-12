# prosemirror-flat-list Introduction

## Overview

prosemirror-flat-list introduces a new [ProseMirror](https://prosemirror.net/) list design that differs from [prosemirror-schema-list](https://github.com/ProseMirror/prosemirror-schema-list).

## Features

### Simpler Data Structure

The project streamlines list implementation by providing a single `list` node type. Any block nodes can be children of a list node, including nested lists. The initial child isn't restricted to paragraphs either.

This "flat" approach avoids using `<ul>` and `<ol>` elements to wrap items, resulting in a cleaner structure. List nodes render as `<div>` elements instead.

### New List Kinds

Beyond the standard `bullet` and `ordered` lists, two additional types are supported:

- `task` lists (with checkbox interaction)
- `toggle` lists (collapsible sections)

Both support mouse-based interaction.

### Accurate Indent and Dedent Range

The indent/dedent commands (`liftListItem` and `sinkListItem` equivalents) now move only the selected portion of content, avoiding unintended shifts of unselected paragraphs.

### Arbitrary Indentations

Since list nodes can contain nested lists as first children, multiple bullet points can appear on a single line. This enables flexible indentation by hiding non-final bullets.

### Input Rules

Quick-start keyboard shortcuts create lists:

- `-` or `*` + space → bullet list
- `1.` + space → ordered list
- `[ ]` or `[x]` + space → task list
- `>>` + space → toggle list

The `wrappingListInputRule` function allows custom input rule creation.

### Migration

Use the `migrateDocJSON` function to convert documents from prosemirror-schema-list format. It transforms old list structures into the new flat design automatically.

Example transformation:

```javascript
import { migrateDocJSON } from 'prosemirror-flat-list'

const oldDoc = {
  type: 'doc',
  content: [{
    type: 'ordered_list',
    content: [{
      type: 'list_item',
      content: [{ type: 'paragraph', text: 'Item 1' }]
    }]
  }]
}

const newDoc = migrateDocJSON(oldDoc)
// Returns flat list structure
```

---

**Resources:** [GitHub Repository](https://github.com/ocavue/prosemirror-flat-list) | [Guide](/guides/)
