# Keyboard shortcuts

## Global

| Action            | Shortcut                              |
| ----------------- | ------------------------------------- |
| Command menu      | <kbd>⌘</kbd> <kbd>K</kbd>             |
| New note          | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>O</kbd> |
| Save              | <kbd>⌘</kbd> <kbd>S</kbd>             |
| Toggle help panel | <kbd>⌘</kbd> <kbd>/</kbd>             |

## Block editor

The editor has two modes, like Notion: **select** (a block is highlighted) and
**edit** (a textarea is focused inside a block). The bindings below are defined
declaratively in `src/blocks/keymap.ts` and dispatched through the command layer
(`src/blocks/commands.ts`) — see `docs/block-editor-architecture.md`.

### Select mode (a block is highlighted)

| Action                          | Shortcut                              |
| ------------------------------- | ------------------------------------- |
| Edit the block                  | <kbd>↵</kbd>                          |
| Move highlight up / down        | <kbd>↑</kbd> / <kbd>↓</kbd>           |
| Indent / outdent                | <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd> |
| Move block (with its subtree)   | <kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>↑</kbd> / <kbd>↓</kbd> |
| Delete block                    | <kbd>⌫</kbd> / <kbd>⌦</kbd>           |
| Collapse / expand (if nested)   | <kbd>Space</kbd>                      |
| Toggle checkbox (todo blocks)   | <kbd>x</kbd>                          |

### Edit mode (typing in a block)

| Action                                        | Shortcut                              |
| --------------------------------------------- | ------------------------------------- |
| Stop editing (back to highlight)              | <kbd>Esc</kbd>                        |
| New block below (bullet by default)           | <kbd>↵</kbd>                          |
| Plain line break (split at caret, no marker)  | <kbd>⇧</kbd> <kbd>↵</kbd>             |
| Indent / outdent                              | <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd> |
| Move block (with its subtree)                 | <kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>↑</kbd> / <kbd>↓</kbd> |
| Move to block above / below (at line edge)    | <kbd>↑</kbd> / <kbd>↓</kbd>           |
| Strip the block's marker → merge up           | <kbd>⌫</kbd> at line start           |
| Focus the note title                          | <kbd>↑</kbd> from the first block     |

Enter from a heading nests the new block underneath it. Enter on an empty list
item exits the list.

### Note title

| Action                     | Shortcut     |
| -------------------------- | ------------ |
| Drop back into the editor  | <kbd>↓</kbd> |
| Commit rename              | <kbd>↵</kbd> |
| Cancel rename              | <kbd>Esc</kbd> |

### Document

| Action | Shortcut                                                            |
| ------ | ------------------------------------------------------------------ |
| Undo   | <kbd>⌘</kbd> <kbd>Z</kbd>                                          |
| Redo   | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>Z</kbd> / <kbd>⌘</kbd> <kbd>Y</kbd> |

Undo/redo operate on the whole document (a single keystroke can walk back a
change that spanned several blocks) and survive a save.

### Moving through tree structures — the convention

For "quickly navigate up and down" outline structures, the cross-app conventions
are:

- **Traverse** the outline: plain <kbd>↑</kbd> / <kbd>↓</kbd> move the
  cursor/highlight one block at a time (this app; Notion; Workflowy; Logseq).
- **Reorder** a block and its subtree among its siblings:
  <kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>↑/↓</kbd> (Logseq, Workflowy) — Notion uses
  <kbd>⌘</kbd>/<kbd>Ctrl</kbd> <kbd>⇧</kbd> <kbd>↑/↓</kbd>. Ruminate uses the
  Option/Alt+Shift form.
- **Change depth**: <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd> (universal).

There isn't a strong cross-app convention for "jump to the next sibling / parent
/ top" with a modifier; if you want that we can add <kbd>⌘</kbd> <kbd>↑/↓</kbd>
for jump-to-top/bottom later.
