import { useState } from "react"
import { parse } from "../../blocks/parse"
import { serialize } from "../../blocks/serialize"
import { emptyBlock } from "../../blocks/ops"
import type { BlockDoc } from "../../blocks/types"
import { useCollapseState } from "../../data/view-state"
import { BlockEditor } from "./block-editor"

/** Ensure a parsed doc always has at least one block to edit. */
function withStarterBlock(doc: BlockDoc): BlockDoc {
  if (doc.rootBlockIds.length > 0) return doc
  const block = emptyBlock()
  return { ...doc, rootBlockIds: [block.id], blocks: { [block.id]: block } }
}

/**
 * Keep an empty block at the very bottom, so there's always somewhere to click
 * and start typing (like Notion). No-op if the last root block is already an
 * empty, childless block.
 */
function ensureTrailingBlank(doc: BlockDoc): BlockDoc {
  const lastId = doc.rootBlockIds[doc.rootBlockIds.length - 1]
  const last = lastId ? doc.blocks[lastId] : undefined
  if (last && last.content === "" && last.children.length === 0) return doc
  const block = emptyBlock()
  return {
    ...doc,
    rootBlockIds: [...doc.rootBlockIds, block.id],
    blocks: { ...doc.blocks, [block.id]: block },
  }
}

/**
 * Adapts the block editor to the note page's string-based value model. The
 * note's markdown is parsed into blocks once (on mount); each edit serializes
 * back to markdown and calls `onChange`, so the surrounding page keeps its
 * existing save/draft logic. Remount (via a `key`) to load a different note.
 */
export function BlockNoteEditor({
  value,
  onChange,
  noteId,
  startEditing,
  highlightHeading,
  onExitTop,
  focusFirstSignal,
  newRootSignal,
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  /**
   * The note's id. When provided, collapse state is persisted across reloads
   * and devices via the view-state sidecar; without it, collapse is transient
   * local state (e.g. Storybook / standalone usage).
   */
  noteId?: string
  /** Start with the first block in edit mode (e.g. a brand-new note). */
  startEditing?: boolean
  /** Heading text to highlight/scroll to on landing (e.g. from Cmd-K). */
  highlightHeading?: string
  /** Navigating up past the first block hands focus here (e.g. the note title). */
  onExitTop?: () => void
  /** Bump to move focus into the first block (e.g. Down-arrow from the title). */
  focusFirstSignal?: number
  /** Bump to add a new root block (e.g. Cmd+Enter from the title). */
  newRootSignal?: number
  /** Display-only: render the note as read-only blocks (e.g. past-day history). */
  readOnly?: boolean
}) {
  const [doc, setDoc] = useState<BlockDoc>(() => {
    const parsed = withStarterBlock(parse(value))
    // Read-only history views are shown verbatim; only editable notes get the
    // always-present trailing blank.
    return readOnly ? parsed : ensureTrailingBlank(parsed)
  })
  const { collapsed, toggleCollapse } = useCollapseState(noteId)

  const handleChange = (next: BlockDoc) => {
    const withBlank = readOnly ? next : ensureTrailingBlank(next)
    setDoc(withBlank)
    onChange(serialize(withBlank))
  }

  return (
    <BlockEditor
      doc={doc}
      onChange={handleChange}
      startEditing={startEditing}
      highlightHeading={highlightHeading}
      collapsed={noteId ? collapsed : undefined}
      onToggleCollapse={noteId ? toggleCollapse : undefined}
      onExitTop={onExitTop}
      focusFirstSignal={focusFirstSignal}
      newRootSignal={newRootSignal}
      readOnly={readOnly}
    />
  )
}
