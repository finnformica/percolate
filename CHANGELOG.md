# Changelog

## 2026-W34

### New

- Past days in the calendar now show what you actually wrote that day, reconstructed from your Git history. It's a read-only view that merges every note you touched, with that day's note first — while today stays fully editable as before. Commit times are shown in your current timezone, and daily notes stay pinned to their date wherever in the world you open them.
- Hovering a note in the sidebar now reveals a three-dots actions menu — pin, copy, rename, open in GitHub, or delete any note without opening it first.
- Move a block and everything nested under it with <kbd>⌥⇧↑</kbd> / <kbd>⌥⇧↓</kbd>. The note title is now reachable from the keyboard too: press <kbd>↑</kbd> from the first block to jump up and edit it, <kbd>↓</kbd> to drop back into the note.

### Changed

- Daily notes now use the same block/outline editor as the rest of your notes, and past days render their history as blocks too — one consistent editing and reading experience across the app.
- The block editor is now the only editor in the app — weekly notes and inline property editing moved onto it too, so editing works the same everywhere.
- Headings are now sized by how deeply they're nested in the outline (down to a bold, underlined body-size floor) rather than by how many `#`s you type, and get a little breathing room above them.
- The editor feels more like an outliner: <kbd>Enter</kbd> starts a bullet by default (and nests under a heading), <kbd>⇧Enter</kbd> is a plain line break, <kbd>Space</kbd> never scrolls the page, <kbd>Tab</kbd>/<kbd>⇧Tab</kbd> and <kbd>⌫</kbd> work on a highlighted block without entering it, and there's always a blank block waiting at the bottom.
- Undo and redo now survive saving a note.
- The app icon is now a monospace `#`.

### Removed

- Vim mode has been removed along with the old CodeMirror-based editor. (In-editor wikilink/date autocomplete, cursor-position template insertion, and drag-to-attach were part of that editor and are tracked to be rebuilt on the block editor.)

## 2026-W08

### Improved

- Move tasks to any note, not just Today/Tomorrow/Next week. The "Move to" menu now lets you search across your notes, use natural dates ("friday", "next month", "in 2 weeks"), or create a new note on the fly.

## 2026-W06

### New

- Notes with an IMDb `url` now display movie and TV poster art, similar to how notes with an `isbn` show book covers.

### Improved

- Cheatsheet dialog replaced with a help panel (⌘/) that stays open while you work, so you can reference shortcuts or markdown syntax without interrupting what you're doing.
- Hovering a footnote reference now shows a preview of the footnote content, so you can read it without jumping to the bottom of the page.
- "Read" and "Write" renamed to "View" and "Edit" in the note page mode switcher for clarity.

### Fixed

- Quotes in shared note titles now display correctly in link previews (e.g. when sharing a note on Discord or Twitter).
