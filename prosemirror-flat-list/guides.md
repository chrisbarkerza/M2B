# prosemirror-flat-list Guide

## Requirements

You need an existing ProseMirror project. Alternatively, you can use the [prosemirror-playground](https://github.com/ocavue/prosemirror-playground) to set one up.

## Installation

```bash
npm install prosemirror-flat-list
```

## Usage

```javascript
import {
  createListPlugins,
  createListSpec,
  listInputRules,
  listKeymap,
} from 'prosemirror-flat-list'
```

## Schema

Add a `list` node type to your schema using `createListSpec`:

```javascript
import { createListSpec } from 'prosemirror-flat-list'
import { Schema } from 'prosemirror-model'

const mySchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    /* ... and so on */
    list: createListSpec(),
  },
})
```

### Extending Existing Schemas

If you already have a schema (like from prosemirror-example-setup):

```javascript
import { schema } from 'prosemirror-schema-basic'

const mySchema = new Schema({
  nodes: schema.spec.nodes.append({ list: createListSpec() }),
  marks: schema.spec.marks,
})
```

### Node Attributes

The `list` node type supports these attributes:

- **kind**: Defines list style (`bullet`, `ordered`, `task`, or `toggle`). Default: `bullet`
- **counter**: Optional number for ordered list numbering
- **checked**: Boolean for task list checkbox state
- **collapsed**: Boolean for toggle list collapse state

## Keymap

Add keybindings using the provided keymap:

```javascript
import { keymap } from 'prosemirror-keymap'
import { listKeymap } from 'prosemirror-flat-list'

const listKeymapPlugin = keymap(listKeymap)
```

**Note**: Add this plugin before others that handle similar keybindings.

## Input Rules

Enable automatic list creation through input patterns:

```javascript
import { inputRules } from 'prosemirror-inputrules'
import { listInputRules } from 'prosemirror-flat-list'

const listInputRulePlugin = inputRules({ rules: listInputRules })
```

## Additional Plugins

Create supplementary list-related plugins:

```javascript
import { createListPlugins } from 'prosemirror-flat-list'

const listPlugins = createListPlugins({ schema })
```

## Commands

The library provides multiple commands for list manipulation. Reference the API documentation for details.

## Example Project

A complete implementation example is available at: [prosemirror-flat-list/examples/with-prosemirror](https://github.com/ocavue/prosemirror-flat-list/tree/master/examples/with-prosemirror)
