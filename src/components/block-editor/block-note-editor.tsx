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
 * Adapts the block editor to the note page's string-based value model. The
 * note's markdown is parsed into blocks once (on mount); each edit serializes
 * back to markdown and calls `onChange`, so the surrounding page keeps its
 * existing save/draft logic. Remount (via a `key`) to load a different note.
 */
export function BlockNoteEditor({
  value,
  onChange,
  noteId,
  historyResetToken,
  startEditing,
  highlightHeading,
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
  /** Changes on save; collapses the block editor's local undo history. */
  historyResetToken?: unknown
  /** Start with the first block in edit mode (e.g. a brand-new note). */
  startEditing?: boolean
  /** Heading text to highlight/scroll to on landing (e.g. from Cmd-K). */
  highlightHeading?: string
  /** Display-only: render the note as read-only blocks (e.g. past-day history). */
  readOnly?: boolean
}) {
  const [doc, setDoc] = useState<BlockDoc>(() => withStarterBlock(parse(value)))
  const { collapsed, toggleCollapse } = useCollapseState(noteId)

  const handleChange = (next: BlockDoc) => {
    setDoc(next)
    onChange(serialize(next))
  }

  return (
    <BlockEditor
      doc={doc}
      onChange={handleChange}
      historyResetToken={historyResetToken}
      startEditing={startEditing}
      highlightHeading={highlightHeading}
      collapsed={noteId ? collapsed : undefined}
      onToggleCollapse={noteId ? toggleCollapse : undefined}
      readOnly={readOnly}
    />
  )
}
