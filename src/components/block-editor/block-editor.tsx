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
 * and saves it); this component manages only transient UI state and emits new
 * docs via `onChange`.
 *
 * There are two modes, like Notion:
 * - **select** — a block is highlighted; arrow keys move the highlight and
 *   Enter (or a double-click) starts editing it. This is the default.
 * - **edit** — a textarea is focused inside the block; Escape returns to
 *   select, and arrows at the first/last line move to the adjacent block.
 *
 * Each block's content is raw markdown, rendered per-block and edited in place.
 */
export function BlockEditor({
  doc,
  onChange,
}: {
  doc: BlockDoc
  onChange: (doc: BlockDoc) => void
}) {
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [selected, setSelected] = useState<string | null>(() => doc.rootBlockIds[0] ?? null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Blocks in the order they appear on screen (depth-first, skipping the
  // children of collapsed blocks). Used for up/down navigation.
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

  const select = (id: string) => {
    setFocus(null)
    setSelected(id)
  }
  const edit = (id: string, atStart = false) => {
    setSelected(id)
    setFocus({ id, atStart })
  }

  const api: BlockEditorApi = {
    focus,
    selected,
    collapsed,
    select,
    edit,
    escapeEdit: (id) => select(id),
    moveSelection: (id, direction) => {
      const i = visibleOrder.indexOf(id)
      if (i === -1) return
      const next = direction === "up" ? i - 1 : i + 1
      if (next >= 0 && next < visibleOrder.length) setSelected(visibleOrder[next])
    },
    toggleCollapse: (id) =>
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    setFocus,
    onContentChange: (id, content) => onChange(updateContent(doc, id, content)),
    onEnter: (id) => {
      const fresh = emptyBlock()
      onChange(insertAfter(doc, id, fresh))
      edit(fresh.id)
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
      if (focusId) edit(focusId)
    },
    onArrowUp: (id) => {
      const i = visibleOrder.indexOf(id)
      if (i > 0) edit(visibleOrder[i - 1], false)
    },
    onArrowDown: (id) => {
      const i = visibleOrder.indexOf(id)
      if (i >= 0 && i < visibleOrder.length - 1) edit(visibleOrder[i + 1], true)
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
