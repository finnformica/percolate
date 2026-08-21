import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ClipboardEvent, FocusEvent, KeyboardEvent } from "react"
import type { BlockDoc } from "../../blocks/types"
import { getBlockType, stripMarker } from "../../blocks/block-type"
import {
  runCommand,
  type CaretInput,
  type CommandInput,
  type CommandResult,
  type FocusIntent,
  type Mode,
} from "../../blocks/commands"
import { resolveKey, type KeyLike } from "../../blocks/keymap"
import { parse } from "../../blocks/parse"
import {
  emptyBlock,
  indentBlock,
  outdentBlock,
  removeBlock,
  siblingsOf,
  spliceBlocks,
  updateContent,
} from "../../blocks/ops"
import { copyAsMarkdown } from "../../utils/copy-markdown"
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

/** The first block (in document order) present in `restored` but not in
 * `current` — the block an undo brought back, e.g. after a delete. */
function findReappeared(current: BlockDoc, restored: BlockDoc): string | null {
  let found: string | null = null
  const walk = (ids: string[]) => {
    for (const id of ids) {
      if (found) return
      if (!(id in current.blocks)) {
        found = id
        return
      }
      const block = restored.blocks[id]
      if (block) walk(block.children)
    }
  }
  walk(restored.rootBlockIds)
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
  startEditing = false,
  highlightHeading,
  collapsed: collapsedProp,
  onToggleCollapse,
  onExitTop,
  focusFirstSignal,
  newRootSignal,
  readOnly = false,
}: {
  doc: BlockDoc
  onChange: (doc: BlockDoc) => void
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
  /** Called when the user navigates up past the first block — lets the caller
   * move focus to whatever sits above the editor (e.g. the note title). */
  onExitTop?: () => void
  /** Bump this (e.g. Down-arrow from the note title) to focus the first block. */
  focusFirstSignal?: number
  /** Bump this (e.g. Cmd+Enter on the note title) to add a new root block. */
  newRootSignal?: number
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
  // The other end of a multi-block selection (Shift+Arrow). null = single select.
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const history = useBlockHistory(onChange)

  // The container is the focusable keyboard target for select mode.
  const containerRef = useRef<HTMLDivElement>(null)
  const focusContainer = () => {
    if (!readOnly) containerRef.current?.focus({ preventScroll: true })
  }

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

  // The selected block ids. Single select is just `[selected]`; a Shift+Arrow
  // range is the contiguous span of `visibleOrder` between anchor and head.
  const selectedIds: string[] = useMemo(() => {
    if (!selected) return []
    if (!anchorId || anchorId === selected) return [selected]
    const a = visibleOrder.indexOf(anchorId)
    const b = visibleOrder.indexOf(selected)
    if (a === -1 || b === -1) return [selected]
    const [lo, hi] = a < b ? [a, b] : [b, a]
    return visibleOrder.slice(lo, hi + 1)
  }, [selected, anchorId, visibleOrder])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const select = (id: string) => {
    setFocus(null)
    setAnchorId(null)
    setSelected(id)
    // Grab keyboard focus so arrows work immediately, even re-clicking the block
    // that's already highlighted (which wouldn't trigger the focus effect).
    focusContainer()
  }

  // Extend the multi-selection by moving the head one block along, keeping the
  // anchor fixed (starting a range from the current head if there isn't one).
  const extendSelection = (direction: "up" | "down") => {
    if (!selected) return
    const i = visibleOrder.indexOf(selected)
    if (i === -1) return
    const next = direction === "up" ? i - 1 : i + 1
    if (next < 0 || next >= visibleOrder.length) return
    if (!anchorId) setAnchorId(selected)
    setFocus(null)
    setSelected(visibleOrder[next])
  }

  // The top-level blocks of the selection (those with no selected ancestor), in
  // document order — the roots to act on so a subtree is moved/copied once.
  const selectionRoots = (): string[] => {
    const set = selectedSet
    return selectedIds.filter((id) => {
      let parent = siblingsOf(doc, id)?.parentId ?? null
      while (parent) {
        if (set.has(parent)) return false
        parent = siblingsOf(doc, parent)?.parentId ?? null
      }
      return true
    })
  }

  const indentSelection = () => {
    let next = doc
    // In document order: each block's new previous sibling is the one the group
    // is nesting under, so a contiguous sibling range nests together.
    for (const id of selectionRoots()) next = indentBlock(next, id)
    if (next !== doc) history.commit(doc, next, { type: "structural" })
  }
  const outdentSelection = () => {
    let next = doc
    // Reverse order keeps siblings in place as each is lifted out.
    for (const id of [...selectionRoots()].reverse()) next = outdentBlock(next, id)
    if (next !== doc) history.commit(doc, next, { type: "structural" })
  }
  const removeSelection = () => {
    let next = doc
    let focusId: string | null = null
    for (const id of selectionRoots()) {
      if (!next.blocks[id]) continue
      const result = removeBlock(next, id)
      next = result.doc
      focusId = result.focusId
    }
    if (next === doc) return
    // The focus target may itself have been part of the selection.
    if (focusId && !next.blocks[focusId]) focusId = null
    history.commit(doc, next, { type: "structural" })
    setAnchorId(null)
    setFocus(null)
    // An emptied doc regains a blank block via the editor's trailing-blank rule.
    setSelected(focusId ?? next.rootBlockIds[0] ?? null)
  }

  // Serialize the selected subtrees to block markdown (markers + nesting) so it
  // round-trips through paste.
  const selectionMarkdown = (): string => {
    const lines: string[] = []
    const walk = (id: string, depth: number) => {
      const block = doc.blocks[id]
      if (!block) return
      lines.push("  ".repeat(depth) + block.content)
      for (const childId of block.children) walk(childId, depth + 1)
    }
    for (const id of selectionRoots()) walk(id, 0)
    return lines.join("\n")
  }
  const copySelection = () => {
    // Route through the shared copy path so it's clean display markdown.
    copyAsMarkdown(selectionMarkdown())
  }
  const cutSelection = () => {
    copySelection()
    removeSelection()
  }
  // When the caller bumps `focusFirstSignal` (e.g. Down-arrow from the note
  // title), highlight the first block — moving between the title and the blocks
  // moves the highlight, like moving between blocks.
  useEffect(() => {
    if (!focusFirstSignal || readOnly) return
    const first = docRef.current.rootBlockIds[0]
    if (first) {
      setFocus(null)
      setSelected(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFirstSignal])

  // When the caller bumps `newRootSignal` (e.g. Cmd+Enter on the note title),
  // add a fresh root block at the top and edit it.
  useEffect(() => {
    if (!newRootSignal || readOnly) return
    const current = docRef.current
    const fresh = emptyBlock()
    const next: BlockDoc = {
      ...current,
      rootBlockIds: [fresh.id, ...current.rootBlockIds],
      blocks: { ...current.blocks, [fresh.id]: fresh },
    }
    history.commit(current, next, { type: "structural" })
    setAnchorId(null)
    setSelected(fresh.id)
    setFocus({ id: fresh.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newRootSignal])

  const edit = (id: string, atStart = false) => {
    if (readOnly) return
    setAnchorId(null)
    setSelected(id)
    setFocus({ id, atStart })
  }

  // After restoring a snapshot, keep editing/selecting the same block if it
  // still exists; otherwise fall back to select mode on a valid block.
  const reconcileToDoc = (restored: BlockDoc) => {
    setAnchorId(null)
    // If a block reappeared (e.g. undo of a delete), highlight it so the thing
    // you brought back is where your focus lands.
    const reappeared = findReappeared(doc, restored)
    if (reappeared) {
      setFocus(null)
      setSelected(reappeared)
      return
    }
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

  const toggleCollapse = (id: string) => {
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
  }

  // Interpret a command's result: commit any doc change to history, toggle
  // collapse, and move focus/selection where the command asked.
  const applyFocus = (intent: FocusIntent) => {
    // Any single-target command collapses a multi-block selection.
    setAnchorId(null)
    if (intent.mode === "select") {
      setFocus(null)
      setSelected(intent.id)
    } else {
      setSelected(intent.id)
      setFocus({ id: intent.id, atStart: intent.atStart, caret: intent.caret })
    }
  }
  const applyResult = (result: CommandResult) => {
    if (result.doc) history.commit(doc, result.doc, result.op ?? { type: "structural" })
    if (result.toggleCollapse) toggleCollapse(result.toggleCollapse)
    if (result.focus) applyFocus(result.focus)
    if (result.exitTop) {
      // Leaving the top clears the block highlight so nothing stays selected
      // below while focus moves up to the title.
      setFocus(null)
      setSelected(null)
      setAnchorId(null)
      onExitTop?.()
    }
  }

  // The single entry point every keyboard handler funnels through: resolve the
  // event to a command via the keymap and run it. Touch/menu entry points would
  // dispatch the same commands. Returns whether the gesture was consumed.
  const dispatchKey = (mode: Mode, id: string, event: KeyLike, caret?: CaretInput): boolean => {
    if (readOnly) return false
    const input: CommandInput = { doc, id, mode, visibleOrder, caret }
    const name = resolveKey(mode, event, input)
    if (!name) return false
    const result = runCommand(name, input)
    applyResult(result)
    return result.handled
  }

  const api: BlockEditorApi = {
    focus,
    selected,
    selectedSet,
    collapsed,
    readOnly,
    select,
    edit,
    toggleCollapse,
    setFocus,
    onContentChange: (id, content) =>
      history.commit(doc, updateContent(doc, id, content), { type: "text", blockId: id }),
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
    dispatchKey,
  }

  // The container is the single keyboard target for select mode (see the focus
  // effect below). Edit mode is handled by the focused textarea inside the
  // block; those events also bubble here, so we bail while editing.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes — at the document
    // level, so a single keystroke can walk back changes across many blocks.
    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        if (undo()) event.preventDefault()
        return
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        if (redo()) event.preventDefault()
        return
      }
      // other Cmd combos (Cmd+Enter, Cmd+Arrow, Cmd+C/X) fall through below
    }

    // Edit mode: the textarea's own handler owns the keys; don't double-handle.
    if (focus || !selected || event.defaultPrevented) return
    const id = selected
    const mod = event.metaKey || event.ctrlKey

    // Shift+Arrow grows / shrinks a multi-block selection — but NOT when Cmd/Ctrl
    // is also held (that's the move-block shortcut, handled via the keymap).
    if (event.shiftKey && !mod && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault()
      extendSelection(event.key === "ArrowUp" ? "up" : "down")
      return
    }
    // Copy / cut the current selection — one block or many.
    if (mod && event.key.toLowerCase() === "c") {
      event.preventDefault()
      copySelection()
      return
    }
    if (mod && event.key.toLowerCase() === "x") {
      event.preventDefault()
      cutSelection()
      return
    }
    // Actions that only make sense on a multi-block selection.
    if (selectedIds.length > 1) {
      if (event.key === "Tab") {
        event.preventDefault()
        if (event.shiftKey) outdentSelection()
        else indentSelection()
        return
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault()
        removeSelection()
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        select(id)
        return
      }
    }
    // Single-select: resolve through the keymap.
    if (dispatchKey("select", id, event)) event.preventDefault()
  }

  // Keep the container focused whenever a block is highlighted (select mode), so
  // arrow keys always move the highlight instead of scrolling the page — even
  // after a structural change or after focus drifted to a non-interactive spot.
  // Edit mode is left alone (the textarea owns focus). `preventScroll` stops the
  // focus call from jumping the page around on every doc change.
  useLayoutEffect(() => {
    if (readOnly || focus || !selected) return
    const el = containerRef.current
    if (!el) return
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, focus, anchorId, doc, readOnly])

  // Keep the highlighted block in a comfortable band (roughly the middle) as it
  // moves, since focusing the container itself no longer scrolls it into view.
  useLayoutEffect(() => {
    if (readOnly || focus || !selected) return
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-block-row="${selected}"]`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    // Only scroll when it drifts out of the middle ~60% — small moves don't jump.
    if (rect.top < vh * 0.2 || rect.bottom > vh * 0.8) {
      if (typeof el.scrollIntoView === "function")
        el.scrollIntoView({ block: "center", behavior: "auto" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, focus, readOnly])

  // When focus falls to nothing (a click on empty page space) while a block is
  // still highlighted, keep the keyboard alive by re-grabbing focus. A click on
  // a real control elsewhere (relatedTarget set) is left to take focus.
  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (readOnly || focus || !selected || event.relatedTarget) return
    const el = containerRef.current
    requestAnimationFrame(() => {
      if (el && el.isConnected && !el.contains(document.activeElement)) {
        el.focus({ preventScroll: true })
      }
    })
  }

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
    // The container holds keyboard focus for select mode (tabIndex -1 = focusable
    // only programmatically), so arrows/shortcuts work no matter which block is
    // highlighted. outline-none hides the focus ring on the wrapper itself.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="space-y-0.5 outline-none"
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onBlur={handleContainerBlur}
      onCopy={handleCopy}
    >
      {doc.rootBlockIds.map((id) => {
        const block = doc.blocks[id]
        if (!block) return null
        return <BlockItem key={id} doc={doc} block={block} depth={0} api={api} />
      })}
    </div>
  )
}
