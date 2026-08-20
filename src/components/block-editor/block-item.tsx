import { useLayoutEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { cx } from "../../utils/cx"
import type { Block, BlockDoc } from "../../blocks/types"
import { BlockContent } from "./block-content"

export interface FocusRequest {
  id: string
  atStart?: boolean
}

export interface BlockEditorApi {
  focus: FocusRequest | null
  setFocus: (focus: FocusRequest | null) => void
  collapsed: Set<string>
  toggleCollapse: (id: string) => void
  onContentChange: (id: string, content: string) => void
  onEnter: (id: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  onBackspaceEmpty: (id: string) => void
  /** Move editing focus to the previous/next block in visual order. */
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
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
  const hasChildren = block.children.length > 0
  const isCollapsed = api.collapsed.has(block.id)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      api.onEnter(block.id)
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
      // Move to the previous block only when the caret is already on the first
      // line; otherwise let the textarea handle in-block cursor movement.
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

  return (
    <div>
      <div className="group flex items-start gap-1">
        <button
          type="button"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          onClick={() => api.toggleCollapse(block.id)}
          className={cx(
            "mt-[3px] grid h-5 w-4 shrink-0 place-items-center rounded text-text-tertiary transition-transform hover:bg-bg-secondary",
            !hasChildren && "invisible",
            isCollapsed ? "rotate-0" : "rotate-90",
          )}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
            <path d="M2 1l4 3-4 3z" fill="currentColor" />
          </svg>
        </button>

        <div className="mt-[9px] grid h-2 w-3 shrink-0 place-items-center">
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full bg-text-tertiary",
              isCollapsed && hasChildren && "ring-2 ring-bg-tertiary",
            )}
          />
        </div>

        <div className="min-w-0 flex-1 py-0.5 font-content">
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
              onKeyDown={handleKeyDown}
              onBlur={() => api.setFocus(null)}
              className="w-full resize-none border-none bg-transparent p-0 font-mono text-sm leading-relaxed text-text outline-none"
            />
          ) : (
            <div
              role="button"
              tabIndex={0}
              className="cursor-text leading-relaxed outline-none"
              onClick={() => api.setFocus({ id: block.id })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  api.setFocus({ id: block.id })
                }
              }}
            >
              <BlockContent content={block.content} doc={doc} />
            </div>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <div className="ml-[11px] border-l border-border-secondary pl-3">
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
