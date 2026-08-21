# Keyboard shortcuts

## Global

| Action            | Shortcut                               |
| ----------------- | -------------------------------------- |
| Command menu      | <kbd>⌘</kbd> <kbd>K</kbd>              |
| New note          | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>O</kbd> |
| Save              | <kbd>⌘</kbd> <kbd>S</kbd>              |
| Toggle help panel | <kbd>⌘</kbd> <kbd>/</kbd>              |

## Block editor

The editor has two modes, like Notion: **select** (a block is highlighted) and
**edit** (a textarea is focused inside a block). The bindings below are defined
declaratively in `src/blocks/keymap.ts` and dispatched through the command layer
(`src/blocks/commands.ts`) — see `docs/block-editor-architecture.md`.

### Select mode (a block is highlighted)

| Action                                  | Shortcut                                              |
| --------------------------------------- | ----------------------------------------------------- |
| Edit the block                          | <kbd>↵</kbd>                                          |
| New block below (and edit it)           | <kbd>⌘</kbd> <kbd>↵</kbd> / <kbd>⇧</kbd> <kbd>↵</kbd> |
| Move highlight up / down                | <kbd>↑</kbd> / <kbd>↓</kbd>                           |
| Jump across siblings (same level)       | <kbd>⌥</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>              |
| Jump to top / bottom of the level       | <kbd>⌘</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>              |
| Indent / outdent                        | <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd>              |
| Move block (with its subtree)           | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>↑</kbd> / <kbd>↓</kbd> |
| Extend selection to more blocks         | <kbd>⇧</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>              |
| Delete block(s)                         | <kbd>⌫</kbd> / <kbd>⌦</kbd>                           |
| Copy / cut selection                    | <kbd>⌘</kbd> <kbd>C</kbd> / <kbd>⌘</kbd> <kbd>X</kbd> |
| Collapse / expand (if nested)           | <kbd>Space</kbd>                                      |
| Toggle checkbox (todo blocks)           | <kbd>x</kbd>                                          |
| Focus the note title (from first block) | <kbd>↑</kbd>                                          |

With more than one block selected, <kbd>⇥</kbd> / <kbd>⇧⇥</kbd>, delete, and
copy / cut act on the whole selection; <kbd>Esc</kbd> collapses back to one.

### Edit mode (typing in a block)

| Action                                     | Shortcut                                                 |
| ------------------------------------------ | -------------------------------------------------------- |
| Stop editing (back to highlight)           | <kbd>Esc</kbd>                                           |
| New block below (bullet by default)        | <kbd>↵</kbd>                                             |
| Split into a new block of the same type    | <kbd>⇧</kbd> <kbd>↵</kbd>                                |
| New block below, ignoring the caret        | <kbd>⌘</kbd> <kbd>↵</kbd>                                |
| Indent / outdent                           | <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd>                 |
| Move block (with its subtree)              | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>    |
| Jump across siblings / levels              | <kbd>⌥</kbd> or <kbd>⌘</kbd> <kbd>↑</kbd> / <kbd>↓</kbd> |
| Move to block above / below (at line edge) | <kbd>↑</kbd> / <kbd>↓</kbd>                              |
| Strip the block's marker → merge up        | <kbd>⌫</kbd> at line start                               |

Enter from a heading nests the new block underneath it. Enter on an empty list
item exits the list.

### Note title

| Action                    | Shortcut                                              |
| ------------------------- | ----------------------------------------------------- |
| Select the title          | <kbd>↑</kbd> from the first block                     |
| Edit it                   | <kbd>↵</kbd> (or click)                               |
| New root block below      | <kbd>⌘</kbd> <kbd>↵</kbd> / <kbd>⇧</kbd> <kbd>↵</kbd> |
| Drop back into the editor | <kbd>↓</kbd>                                          |
| Commit rename             | <kbd>↵</kbd>                                          |
| Cancel rename             | <kbd>Esc</kbd>                                        |

### Document

| Action | Shortcut                                                           |
| ------ | ------------------------------------------------------------------ |
| Undo   | <kbd>⌘</kbd> <kbd>Z</kbd>                                          |
| Redo   | <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>Z</kbd> / <kbd>⌘</kbd> <kbd>Y</kbd> |

Undo/redo operate on the whole document (a single keystroke can walk back a
change that spanned several blocks) and survive a save.

### Moving through tree structures — the conventions

- **Traverse** one block at a time: plain <kbd>↑</kbd> / <kbd>↓</kbd>.
- **Skip across a level** (e.g. header→header, past their children):
  <kbd>⌥</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>.
- **Jump to the top / bottom of the current level** (walking up levels rather
  than to the page top): <kbd>⌘</kbd> <kbd>↑</kbd> / <kbd>↓</kbd>.
- **Reorder** a block and its subtree: <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>↑/↓</kbd>
  (the Notion convention; Logseq/Workflowy use Alt+Shift).
- **Change depth**: <kbd>⇥</kbd> / <kbd>⇧</kbd> <kbd>⇥</kbd>.
- **Select a run of blocks**: <kbd>⇧</kbd> <kbd>↑/↓</kbd>, then act on them.
