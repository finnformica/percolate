import { useLayoutEffect, useRef } from "react"
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react"
import { cx } from "../../utils/cx"
import type { Block, BlockDoc } from "../../blocks/types"
import {
  getBlockType,
  leadingMarker,
  stripMarker,
  toggleTodo,
  type BlockType,
} from "../../blocks/block-type"
import { IconButton } from "../icon-button"
import { BlockContent } from "./block-content"
import { caretLineFlags } from "./caret"

export interface FocusRequest {
  id: string
  atStart?: boolean
  /** Explicit caret offset; overrides `atStart` when set. */
  caret?: number
}

export interface BlockEditorApi {
  focus: FocusRequest | null
  /** The highlighted block in select mode (null while editing or unfocused). */
  selected: string | null
  collapsed: Set<string>
  /** Highlight a block (leaves edit mode). */
  select: (id: string) => void
  /** Enter edit mode for a block. */
  edit: (id: string, atStart?: boolean) => void
  /** Leave edit mode and re-highlight the block. */
  escapeEdit: (id: string) => void
  /** Move the highlight to the previous/next visible block. */
  moveSelection: (id: string, direction: "up" | "down") => void
  toggleCollapse: (id: string) => void
  setFocus: (focus: FocusRequest | null) => void
  onContentChange: (id: string, content: string) => void
  /** Insert a new block after `id`, optionally pre-filled (e.g. a list marker). */
  onEnter: (id: string, initial?: string) => void
  /** Insert a new block before `id`, optionally pre-filled (e.g. a list marker). */
  onEnterBefore: (id: string, initial?: string) => void
  /** Split `id`: keep `keepContent`, move the rest into a new block after it. */
  onSplit: (id: string, keepContent: string, newContent: string) => void
  /** Replace `id` with blocks parsed from pasted markdown, placing the caret. */
  onPaste: (id: string, prefix: string, before: string, pasted: string, after: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  onBackspaceEmpty: (id: string) => void
  /** While editing, move edit focus to the previous/next block. */
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
}

/** The marker a new sibling block should carry to continue a list. */
function continuationMarker(type: BlockType): string {
  switch (type.kind) {
    case "bullet":
      return "- "
    case "todo":
      return "[ ] "
    case "ordered":
      return `${type.number + 1}. `
    default:
      return ""
  }
}

/** Typography shared by a block's rendered view and its edit textarea, so
 * switching between them never changes the text's size or weight. */
function typographyFor(type: BlockType): string {
  switch (type.kind) {
    case "heading":
      switch (type.level) {
        case 1:
          return "text-2xl font-bold"
        case 2:
          return "text-xl font-bold"
        case 3:
          return "text-lg font-bold"
        default:
          return "text-base font-bold"
      }
    case "quote":
      return "italic text-text-secondary"
    default:
      return "text-base"
  }
}

export function BlockItem({
  doc,
  block,
  depth,
  api,
}: {
  doc: BlockDoc
  block: Block
  depth: number
  api: BlockEditorApi
}) {
  const editing = api.focus?.id === block.id
  const selected = api.selected === block.id && !editing
  const hasChildren = block.children.length > 0
  const isCollapsed = api.collapsed.has(block.id)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const pendingCaret = useRef<number | null>(null)

  const type = getBlockType(block.content)
  // The block is edited and rendered *without* its marker (the `- `, `# `,
  // `[ ] `, `> `), which is shown as a real bullet/checkbox/heading style. This
  // keeps the view and the editor pixel-identical — nothing shifts on click.
  const body = stripMarker(block.content)
  const prefix = block.content.slice(0, block.content.length - body.length)
  const typo = typographyFor(type)

  // Focus and place the caret when editing starts.
  useLayoutEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    const pos =
      api.focus?.caret !== undefined
        ? Math.min(api.focus.caret, el.value.length)
        : api.focus?.atStart
          ? 0
          : el.value.length
    el.setSelectionRange(pos, pos)
  }, [editing, api.focus?.atStart, api.focus?.caret])

  // Resize on content change, and restore the caret after a marker shortcut
  // reshaped the visible text (e.g. typing `# ` promoted the block to a
  // heading and the `# ` moved out of the textarea).
  useLayoutEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
    if (pendingCaret.current !== null) {
      const pos = pendingCaret.current
      pendingCaret.current = null
      el.setSelectionRange(pos, pos)
    }
  }, [editing, block.content])

  // Give the block keyboard focus while it's the highlighted (selected) one.
  useLayoutEffect(() => {
    if (selected) viewRef.current?.focus()
  }, [selected])

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget
    const newBody = el.value
    const caret = el.selectionStart
    // A marker typed at the very start of the body switches the block's type,
    // *replacing* any current marker (checkbox → `- ` becomes a bullet, → `1. `
    // an ordered item, → `# ` a heading, and so on). Otherwise the block keeps
    // its existing marker and the edit is to its text.
    const typed = leadingMarker(newBody)
    const newContent = typed !== null ? newBody : prefix + newBody
    const derivedBody = stripMarker(newContent)
    if (derivedBody.length !== newBody.length) {
      // A marker moved into (or out of) the prefix; keep the caret relative to
      // the visible text.
      pendingCaret.current = Math.max(0, caret - (newBody.length - derivedBody.length))
    }
    api.onContentChange(block.id, newContent)
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.shiftKey) {
      // Shift-Enter inserts a fresh block *above* the current one (same list
      // style), rather than a soft line break — the file format is one block
      // per line, so in-block newlines aren't representable anyway.
      event.preventDefault()
      api.onEnterBefore(block.id, continuationMarker(type))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const el = event.currentTarget
      const isList = type.kind === "bullet" || type.kind === "todo" || type.kind === "ordered"
      const beforeBody = el.value.slice(0, el.selectionStart)
      const afterBody = el.value.slice(el.selectionEnd)
      const hasSelection = el.selectionStart !== el.selectionEnd
      if (isList && body.trim() === "") {
        // Enter on an empty list item exits the list (becomes a paragraph).
        api.onContentChange(block.id, "")
      } else if (!hasSelection && afterBody === "") {
        // Caret at the end — just start a fresh block.
        api.onEnter(block.id, continuationMarker(type))
      } else {
        // Caret mid-line (or a selection): keep the text before the caret and
        // move the text after it into the new block, continuing the list style.
        api.onSplit(block.id, prefix + beforeBody, continuationMarker(type) + afterBody)
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      api.escapeEdit(block.id)
    } else if (event.key === "Tab") {
      event.preventDefault()
      if (event.shiftKey) api.onOutdent(block.id)
      else api.onIndent(block.id)
    } else if (event.key === "Backspace") {
      const el = event.currentTarget
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        if (prefix !== "") {
          // Backspace at the start strips the block's marker (→ paragraph).
          event.preventDefault()
          api.onContentChange(block.id, body)
        } else if (body === "") {
          event.preventDefault()
          api.onBackspaceEmpty(block.id)
        }
      }
    } else if (event.key === "ArrowUp" && !event.shiftKey && !event.metaKey && !event.altKey) {
      // Only leave the block when the caret is on its first *visual* line —
      // otherwise let the textarea move the caret up within a wrapped block.
      if (caretLineFlags(event.currentTarget).atFirst) {
        event.preventDefault()
        api.onArrowUp(block.id)
      }
    } else if (event.key === "ArrowDown" && !event.shiftKey && !event.metaKey && !event.altKey) {
      if (caretLineFlags(event.currentTarget).atLast) {
        event.preventDefault()
        api.onArrowDown(block.id)
      }
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData?.getData("text/plain") ?? ""
    const normalized = text.replace(/\r\n?/g, "\n")
    // Single-line paste is ordinary inline insertion; only multi-line paste
    // needs to be spread across blocks.
    if (!normalized.includes("\n")) return
    event.preventDefault()
    const el = event.currentTarget
    const before = el.value.slice(0, el.selectionStart)
    const after = el.value.slice(el.selectionEnd)
    api.onPaste(block.id, prefix, before, normalized, after)
  }

  const handleSelectKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      api.edit(block.id)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      api.moveSelection(block.id, "up")
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      api.moveSelection(block.id, "down")
    } else if ((event.key === "x" || event.key === "X") && type.kind === "todo") {
      // Toggle a todo's checkbox from select mode.
      event.preventDefault()
      api.onContentChange(block.id, toggleTodo(block.content))
    } else if (event.key === " " && hasChildren) {
      // Collapse/expand a block with children from select mode.
      event.preventDefault()
      api.toggleCollapse(block.id)
    }
  }

  const marker =
    type.kind === "todo" ? (
      <span className="flex h-[1lh] shrink-0 items-center">
        <input
          type="checkbox"
          checked={type.checked}
          onClick={(event) => event.stopPropagation()}
          onChange={() => api.onContentChange(block.id, toggleTodo(block.content))}
          className="size-4 cursor-pointer accent-text"
        />
      </span>
    ) : type.kind === "bullet" ? (
      <span className="flex h-[1lh] shrink-0 items-center">
        <span aria-hidden className="size-1.5 rounded-full bg-text-secondary" />
      </span>
    ) : type.kind === "ordered" ? (
      <span
        aria-hidden
        className="flex h-[1lh] shrink-0 items-center tabular-nums text-text-secondary"
      >
        {type.number}.
      </span>
    ) : null

  return (
    <div>
      <div className="group relative flex items-start gap-1">
        <IconButton
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          size="small"
          disableTooltip
          tabIndex={-1}
          onClick={() => api.toggleCollapse(block.id)}
          className={cx(
            "mt-0.5 w-6 shrink-0 text-text-tertiary",
            !hasChildren && "pointer-events-none opacity-0",
          )}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            aria-hidden
            className={cx("transition-transform", isCollapsed ? "rotate-0" : "rotate-90")}
          >
            <path d="M2 1l4 3-4 3z" fill="currentColor" />
          </svg>
        </IconButton>

        <div className="min-w-0 flex-1 py-0.5 font-content leading-relaxed">
          <div
            className={cx(
              "flex items-start gap-2 rounded-sm px-1",
              selected && "bg-bg-secondary",
              type.kind === "quote" && "border-l-2 border-border-secondary pl-2",
            )}
          >
            {marker}
            {editing ? (
              <textarea
                ref={textareaRef}
                value={body}
                rows={1}
                spellCheck
                onChange={handleTextareaChange}
                onKeyDown={handleEditKeyDown}
                onPaste={handlePaste}
                onBlur={() => api.setFocus(null)}
                className={cx(
                  "min-w-0 flex-1 resize-none border-none bg-transparent p-0 font-content leading-relaxed text-text outline-none",
                  typo,
                )}
              />
            ) : (
              <div
                ref={viewRef}
                role="button"
                tabIndex={0}
                data-testid="block-body"
                className={cx(
                  "min-h-[1lh] min-w-0 flex-1 cursor-text outline-none",
                  typo,
                  type.kind === "todo" && type.checked && "text-text-secondary line-through",
                )}
                onClick={() => api.select(block.id)}
                onDoubleClick={() => api.edit(block.id)}
                onKeyDown={handleSelectKeyDown}
              >
                <BlockContent content={body} doc={doc} />
              </div>
            )}
          </div>
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <div className="ml-2.5 border-l border-border-secondary pl-3">
          {block.children.map((childId) => {
            const child = doc.blocks[childId]
            if (!child) return null
            return <BlockItem key={childId} doc={doc} block={child} depth={depth + 1} api={api} />
          })}
        </div>
      ) : null}
    </div>
  )
}
