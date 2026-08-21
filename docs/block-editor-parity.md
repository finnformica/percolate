# Block editor parity backlog

The app has consolidated on the **block editor** as its single editor; the
classic CodeMirror editor (`note-editor.tsx`) and its extensions have been
**removed**. This logs the editing features that lived only in CodeMirror so
they can be re-added to the block editor intentionally rather than lost
silently. Everything below is now an active backlog item (see git history of
the removed `src/codemirror-extensions/` for the original implementations).

## Missing in the block editor (candidates to rebuild)

- **Autocomplete as you type** — foundation now rebuilt natively in
  `src/components/block-editor/autocomplete/` (a `CompletionSource` layer +
  engine + menu, mirroring the command/keymap split). Remaining sources to add
  to `sources.ts`:
  - `[[` → wikilink suggestions from existing notes (a `noteCompletionSource`)
  - `#` → tag suggestions (a `tagCompletionSource`)
  - template insertion by name (a `templateCompletionSource`)
- **In-editor natural-language dates** (`chrono-node`): **done** — the
  `dateCompletionSource` offers `[[next monday` → `[[YYYY-MM-DD]]` in the block
  editor, ported from the classic editor's `dateCompletion`.
- **Template insertion at the cursor** (`insert-template.tsx` dispatches into a
  CodeMirror `EditorView`): the block editor has no `EditorView`, so mid-document
  template insertion needs a block-aware equivalent. (Daily/weekly templates that
  fill a _new_ note still work — that path is editor-independent.)
- **File attach at the cursor** (`hooks/attach-file.ts`): drag/paste an image and
  insert the markdown link at the caret. Needs a block-aware insertion point.
- **Frontmatter editing affordances** (`frontmatter` extension, `@codemirror/lang-yaml`):
  the block editor preserves frontmatter verbatim but doesn't surface it for
  editing inline (property editing lives separately in `property-value.tsx`).
- **Markdown source niceties**: syntax highlighting of raw markdown, `priority`,
  `ellipsis`, and `indented-line-wrap` display extensions. Mostly N/A by design —
  the block editor renders _rendered_ content per block rather than highlighted
  source — but noted for completeness.

## Intentionally dropped

- **Vim mode** (`@replit/codemirror-vim`, `vimModeAtom`, the `:w`/`:x`/`:wq`/`:q`
  ex-commands): removed with CodeMirror by decision, not deferred.

## Already covered by the block editor

For reference, these CodeMirror-era behaviours already exist natively in the
block editor and need no rebuild: block types (headings, todos, bullets, ordered,
quote), block references `((blk_…))` with live transclusion, collapse/expand,
per-block markdown rendering, multi-line paste split across blocks, browser
spellcheck (the block textarea sets `spellCheck`), and document-level undo/redo.
