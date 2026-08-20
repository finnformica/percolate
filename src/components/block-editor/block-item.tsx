import { useLayoutEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { cx } from "../../utils/cx"
import type { Block, BlockDoc } from "../../blocks/types"
import { getBlockType, stripMarker, toggleTodo, type BlockType } from "../../blocks/block-type"
import { BlockContent } from "./block-content"

export interface FocusRequest {
  id: string
  atStart?: boolean
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
  onEnter: (id: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  onBackspaceEmpty: (id: string) => void
  /** While editing, move edit focus to the previous/next block. */
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
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

  const type = getBlockType(block.content)
  const body = stripMarker(block.content)
  const typo = typographyFor(type)

  useLayoutEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
    el.focus()
    const pos = api.focus?.atStart ? 0 : el.value.length
    el.setSelectionRange(pos, pos)
  }, [editing, api.focus?.atStart])

  // Give the block keyboard focus while it's the highlighted (selected) one, so
  // arrow keys and Enter reach it.
  useLayoutEffect(() => {
    if (selected) viewRef.current?.focus()
  }, [selected])

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      api.onEnter(block.id)
    } else if (event.key === "Escape") {
      event.preventDefault()
      api.escapeEdit(block.id)
    } else if (event.key === "Tab") {
      event.preventDefault()
      if (event.shiftKey) api.onOutdent(block.id)
      else api.onIndent(block.id)
    } else if (event.key === "Backspace") {
      const el = event.currentTarget
      if (el.selectionStart === 0 && el.selectionEnd === 0 && block.content === "") {
        event.preventDefault()
        api.onBackspaceEmpty(block.id)
      }
    } else if (event.key === "ArrowUp" && !event.shiftKey && !event.metaKey && !event.altKey) {
      // Move to the previous block only when the caret is on the first line.
      const el = event.currentTarget
      if (el.value.lastIndexOf("\n", el.selectionStart - 1) === -1) {
        event.preventDefault()
        api.onArrowUp(block.id)
      }
    } else if (event.key === "ArrowDown" && !event.shiftKey && !event.metaKey && !event.altKey) {
      const el = event.currentTarget
      if (el.value.indexOf("\n", el.selectionStart) === -1) {
        event.preventDefault()
        api.onArrowDown(block.id)
      }
    }
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
    }
  }

  return (
    <div>
      <div className="group flex items-start gap-1">
        <button
          type="button"
          tabIndex={-1}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          onClick={() => api.toggleCollapse(block.id)}
          className={cx(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md text-text-tertiary transition hover:bg-bg-secondary",
            !hasChildren && "pointer-events-none opacity-0",
            isCollapsed ? "rotate-0" : "rotate-90",
          )}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
            <path d="M2 1l4 3-4 3z" fill="currentColor" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 py-0.5 font-content leading-relaxed">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={block.content}
              rows={1}
              spellCheck
              onChange={(event) => {
                autoSize(event.currentTarget)
                api.onContentChange(block.id, event.currentTarget.value)
              }}
              onKeyDown={handleEditKeyDown}
              onBlur={() => api.setFocus(null)}
              className={cx(
                "w-full resize-none border-none bg-transparent p-0 font-content leading-relaxed text-text outline-none",
                typo,
              )}
            />
          ) : (
            <div
              ref={viewRef}
              role="button"
              tabIndex={0}
              className={cx(
                "flex min-h-[1.6em] cursor-text items-start gap-2 rounded-sm px-1 outline-none",
                selected && "bg-bg-secondary",
                type.kind === "quote" && "border-l-2 border-border-secondary pl-3",
              )}
              onClick={() => api.select(block.id)}
              onDoubleClick={() => api.edit(block.id)}
              onKeyDown={handleSelectKeyDown}
            >
              {type.kind === "todo" ? (
                <input
                  type="checkbox"
                  checked={type.checked}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => api.onContentChange(block.id, toggleTodo(block.content))}
                  className="mt-[0.35em] size-4 shrink-0 cursor-pointer accent-text"
                />
              ) : type.kind === "bullet" ? (
                <span
                  aria-hidden
                  className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-text-secondary"
                />
              ) : null}
              <div
                className={cx(
                  "min-w-0 flex-1",
                  typo,
                  type.kind === "todo" && type.checked && "text-text-secondary line-through",
                )}
              >
                <BlockContent content={body} doc={doc} />
              </div>
            </div>
          )}
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
