import { useMemo, useState } from "react"
import type { KeyboardEvent } from "react"
import type { BlockDoc } from "../../blocks/types"
import {
  emptyBlock,
  indentBlock,
  insertAfter,
  insertBefore,
  outdentBlock,
  removeBlock,
  updateContent,
} from "../../blocks/ops"
import { BlockItem, type BlockEditorApi, type FocusRequest } from "./block-item"
import { useBlockHistory } from "./use-block-history"

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
  historyResetToken,
}: {
  doc: BlockDoc
  onChange: (doc: BlockDoc) => void
  /** Changes when the note is saved, collapsing the local undo history. */
  historyResetToken?: unknown
}) {
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [selected, setSelected] = useState<string | null>(() => doc.rootBlockIds[0] ?? null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const history = useBlockHistory(onChange, historyResetToken)

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

  // After restoring a snapshot, keep editing/selecting the same block if it
  // still exists; otherwise fall back to select mode on a valid block.
  const reconcileToDoc = (restored: BlockDoc) => {
    setFocus((cur) => (cur && restored.blocks[cur.id] ? cur : null))
    setSelected((cur) => (cur && restored.blocks[cur] ? cur : (restored.rootBlockIds[0] ?? null)))
  }

  const undo = () => {
    const restored = history.undo(doc)
    if (!restored) return false
    reconcileToDoc(restored)
    return true
  }
  const redo = () => {
    const restored = history.redo(doc)
    if (!restored) return false
    reconcileToDoc(restored)
    return true
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
    onContentChange: (id, content) =>
      history.commit(doc, updateContent(doc, id, content), { type: "text", blockId: id }),
    onEnter: (id, initial = "") => {
      const fresh = emptyBlock(initial)
      history.commit(doc, insertAfter(doc, id, fresh), { type: "structural" })
      edit(fresh.id)
    },
    onEnterBefore: (id, initial = "") => {
      const fresh = emptyBlock(initial)
      history.commit(doc, insertBefore(doc, id, fresh), { type: "structural" })
      edit(fresh.id)
    },
    onIndent: (id) => {
      history.commit(doc, indentBlock(doc, id), { type: "structural" })
      setFocus({ id })
    },
    onOutdent: (id) => {
      history.commit(doc, outdentBlock(doc, id), { type: "structural" })
      setFocus({ id })
    },
    onBackspaceEmpty: (id) => {
      if (doc.rootBlockIds.length === 1 && doc.rootBlockIds[0] === id) return
      const { doc: next, focusId } = removeBlock(doc, id)
      history.commit(doc, next, { type: "structural" })
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

  // Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes — at the document
  // level, overriding the browser's per-textarea native undo so a single
  // keystroke can walk back changes that spanned multiple blocks.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const key = event.key.toLowerCase()
    if (key === "z" && !event.shiftKey) {
      if (undo()) event.preventDefault()
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      if (redo()) event.preventDefault()
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="space-y-0.5" onKeyDown={handleKeyDown}>
      {doc.rootBlockIds.map((id) => {
        const block = doc.blocks[id]
        if (!block) return null
        return <BlockItem key={id} doc={doc} block={block} depth={0} api={api} />
      })}
    </div>
  )
}
