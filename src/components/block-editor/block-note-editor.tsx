import { useState } from "react"
import { parse } from "../../blocks/parse"
import { serialize } from "../../blocks/serialize"
import { emptyBlock } from "../../blocks/ops"
import type { BlockDoc } from "../../blocks/types"
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
  historyResetToken,
  startEditing,
}: {
  value: string
  onChange: (value: string) => void
  /** Changes on save; collapses the block editor's local undo history. */
  historyResetToken?: unknown
  /** Start with the first block in edit mode (e.g. a brand-new note). */
  startEditing?: boolean
}) {
  const [doc, setDoc] = useState<BlockDoc>(() => withStarterBlock(parse(value)))

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
    />
  )
}
