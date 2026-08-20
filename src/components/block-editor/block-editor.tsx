import { useMemo, useState } from "react"
import type { BlockDoc } from "../../blocks/types"
import {
  emptyBlock,
  indentBlock,
  insertAfter,
  outdentBlock,
  removeBlock,
  updateContent,
} from "../../blocks/ops"
import { BlockItem, type BlockEditorApi, type FocusRequest } from "./block-item"

/**
 * A controlled block outliner. `doc` is owned by the caller (which serializes
 * and saves it); this component manages only transient UI state (which block
 * is being edited, which are collapsed) and emits new docs via `onChange`.
 *
 * Each block's content is raw markdown, rendered per-block and edited in place
 * as a textarea (the Pensive approach). Because content *is* markdown, `# `,
 * `> `, `**bold**`, and `((block-ref))` all just work on render — no block
 * types or shortcuts needed.
 */
export function BlockEditor({
  doc,
  onChange,
}: {
  doc: BlockDoc
  onChange: (doc: BlockDoc) => void
}) {
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Blocks in the order they appear on screen (depth-first, skipping the
  // children of collapsed blocks). Used for up/down arrow navigation.
  const visibleOrder = useMemo(() => {
    const order: string[] = []
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const block = doc.blocks[id]
        if (!block) continue
        order.push(id)
        if (!collapsed.has(id)) walk(block.children)
      }
    }
    walk(doc.rootBlockIds)
    return order
  }, [doc, collapsed])

  const api: BlockEditorApi = {
    focus,
    setFocus,
    collapsed,
    toggleCollapse: (id) =>
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    onContentChange: (id, content) => onChange(updateContent(doc, id, content)),
    onEnter: (id) => {
      const fresh = emptyBlock()
      onChange(insertAfter(doc, id, fresh))
      setFocus({ id: fresh.id })
    },
    onIndent: (id) => {
      onChange(indentBlock(doc, id))
      setFocus({ id })
    },
    onOutdent: (id) => {
      onChange(outdentBlock(doc, id))
      setFocus({ id })
    },
    onBackspaceEmpty: (id) => {
      if (doc.rootBlockIds.length === 1 && doc.rootBlockIds[0] === id) return
      const { doc: next, focusId } = removeBlock(doc, id)
      onChange(next)
      if (focusId) setFocus({ id: focusId })
    },
    onArrowUp: (id) => {
      const i = visibleOrder.indexOf(id)
      if (i > 0) setFocus({ id: visibleOrder[i - 1], atStart: false })
    },
    onArrowDown: (id) => {
      const i = visibleOrder.indexOf(id)
      if (i >= 0 && i < visibleOrder.length - 1)
        setFocus({ id: visibleOrder[i + 1], atStart: true })
    },
  }

  return (
    <div className="space-y-0.5">
      {doc.rootBlockIds.map((id) => {
        const block = doc.blocks[id]
        if (!block) return null
        return <BlockItem key={id} doc={doc} block={block} depth={0} api={api} />
      })}
    </div>
  )
}
