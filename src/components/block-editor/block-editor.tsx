import { useEffect, useMemo, useRef, useState } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"
import type { BlockDoc } from "../../blocks/types"
import { getBlockType, stripMarker } from "../../blocks/block-type"
import { parse } from "../../blocks/parse"
import {
  emptyBlock,
  indentBlock,
  insertAfter,
  insertBefore,
  outdentBlock,
  removeBlock,
  spliceBlocks,
  updateContent,
} from "../../blocks/ops"
import { BlockItem, type BlockEditorApi, type FocusRequest } from "./block-item"
import { useBlockHistory } from "./use-block-history"

/** The id of the first heading block whose text matches `heading`, in document
 * order, or null. Used to highlight a heading arrived at from the command menu. */
function findHeadingBlockId(doc: BlockDoc, heading: string): string | null {
  const target = heading.trim()
  let found: string | null = null
  const walk = (ids: string[]) => {
    for (const id of ids) {
      if (found) return
      const block = doc.blocks[id]
      if (!block) continue
      if (
        getBlockType(block.content).kind === "heading" &&
        stripMarker(block.content).trim() === target
      ) {
        found = id
        return
      }
      walk(block.children)
    }
  }
  walk(doc.rootBlockIds)
  return found
}

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
  startEditing = false,
  highlightHeading,
  collapsed: collapsedProp,
  onToggleCollapse,
  readOnly = false,
}: {
  doc: BlockDoc
  onChange: (doc: BlockDoc) => void
  /** Changes when the note is saved, collapsing the local undo history. */
  historyResetToken?: unknown
  /** Start with the first block in edit mode (e.g. a brand-new note). */
  startEditing?: boolean
  /** Highlight the block for this heading text on mount / when it changes. */
  highlightHeading?: string
  /**
   * Collapsed block ids. Optional: when provided (with `onToggleCollapse`),
   * collapse is controlled and persisted by the caller; otherwise it falls back
   * to transient local state (e.g. Storybook / standalone usage).
   */
  collapsed?: Set<string>
  onToggleCollapse?: (id: string) => void
  /** Display-only: renders blocks without any editing (e.g. past-day history). */
  readOnly?: boolean
}) {
  const firstBlockId = doc.rootBlockIds[0] ?? null
  const [focus, setFocus] = useState<FocusRequest | null>(() =>
    startEditing && firstBlockId ? { id: firstBlockId } : null,
  )
  const [selected, setSelected] = useState<string | null>(() =>
    highlightHeading ? (findHeadingBlockId(doc, highlightHeading) ?? firstBlockId) : firstBlockId,
  )
  const [collapsedInternal, setCollapsedInternal] = useState<Set<string>>(new Set())
  const collapsed = collapsedProp ?? collapsedInternal
  const history = useBlockHistory(onChange, historyResetToken)

  // Re-highlight when the target heading changes (Cmd-K into the open note).
  // Reads the latest doc via a ref so this only runs on heading changes.
  const docRef = useRef(doc)
  docRef.current = doc
  useEffect(() => {
    if (!highlightHeading) return
    const id = findHeadingBlockId(docRef.current, highlightHeading)
    if (id) {
      setFocus(null)
      setSelected(id)
    }
  }, [highlightHeading])

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
    if (readOnly) return
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
    readOnly,
    select,
    edit,
    escapeEdit: (id) => select(id),
    moveSelection: (id, direction) => {
      const i = visibleOrder.indexOf(id)
      if (i === -1) return
      const next = direction === "up" ? i - 1 : i + 1
      if (next >= 0 && next < visibleOrder.length) setSelected(visibleOrder[next])
    },
    toggleCollapse: (id) => {
      if (onToggleCollapse) {
        onToggleCollapse(id)
        return
      }
      setCollapsedInternal((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
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
    onSplit: (id, keepContent, newContent) => {
      const fresh = emptyBlock(newContent)
      const updated = updateContent(doc, id, keepContent)
      history.commit(doc, insertAfter(updated, id, fresh), { type: "structural" })
      edit(fresh.id, true)
    },
    onPaste: (id, prefix, before, pasted, after) => {
      // Re-form the block's line with the pasted text spliced in at the caret,
      // then parse the whole thing so markdown prefixes and blank lines become
      // the right blocks. The current block's marker stays on the first line.
      const sub = parse(prefix + before + pasted + after)
      const result = spliceBlocks(doc, id, sub)
      if (!result) return
      history.commit(doc, result.doc, { type: "structural" })
      // Place the caret at the paste boundary — just before the trailing text.
      const last = result.doc.blocks[result.lastId]
      const caret = Math.max(0, stripMarker(last.content).length - after.length)
      setSelected(result.lastId)
      setFocus({ id: result.lastId, caret })
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

  // Copying a selection that spans blocks yields the *markdown* (markers and
  // nesting), not just the rendered text — so it round-trips (paste re-parses
  // it) and carries structure elsewhere. A selection within one block keeps
  // the browser's default (the plain selected text).
  const containerRef = useRef<HTMLDivElement>(null)
  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const picked: string[] = []
    const walk = (ids: string[], depth: number) => {
      for (const id of ids) {
        const block = doc.blocks[id]
        if (!block) continue
        const el = containerRef.current?.querySelector(`[data-block-id="${id}"]`)
        if (el && selection.containsNode(el, true)) {
          picked.push("  ".repeat(depth) + block.content)
        }
        walk(block.children, depth + 1)
      }
    }
    walk(doc.rootBlockIds, 0)

    // Only take over for multi-block selections; a partial single-block copy
    // is better served by the plain selected text.
    if (picked.length < 2) return
    event.clipboardData.setData("text/plain", picked.join("\n"))
    event.preventDefault()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="space-y-0.5" ref={containerRef} onKeyDown={handleKeyDown} onCopy={handleCopy}>
      {doc.rootBlockIds.map((id) => {
        const block = doc.blocks[id]
        if (!block) return null
        return <BlockItem key={id} doc={doc} block={block} depth={0} api={api} />
      })}
    </div>
  )
}
