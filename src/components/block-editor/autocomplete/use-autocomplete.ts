import { useCallback, useRef, useState, type KeyboardEvent, type RefObject } from "react"
import { caretCoords } from "../caret"
import { queryCompletions, type ActiveCompletion } from "./engine"
import { COMPLETION_SOURCES } from "./sources"
import type { CompletionApply } from "./types"

/** What a key press did to the menu: apply an option, swallow the key, or
 * leave it for the block editor's own handler. */
export type CompletionKeyResult = CompletionApply | "handled" | null

/**
 * Drives the completion menu for one block's textarea. It recomputes the active
 * menu from the live text + caret, owns selection and keyboard navigation, and
 * hands back the edit to apply when an option is accepted. The block owns the
 * textarea's value, so applying the edit is left to the caller.
 */
export function useAutocomplete(textareaRef: RefObject<HTMLTextAreaElement>) {
  const [active, setActive] = useState<ActiveCompletion | null>(null)
  const [index, setIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  // The query string dismissed via Escape; keeps the menu shut until the
  // trigger text changes, so a recompute on key-up doesn't reopen it.
  const dismissed = useRef<string | null>(null)

  const close = useCallback(() => {
    setActive(null)
    setPosition(null)
    setIndex(0)
  }, [])

  /** Re-query the sources against the textarea's current text + caret. Call on
   * input and whenever the caret moves. */
  const recompute = useCallback(() => {
    const el = textareaRef.current
    if (!el) return close()
    const next = queryCompletions(el.value, el.selectionStart, COMPLETION_SOURCES)
    if (!next) {
      dismissed.current = null
      return close()
    }
    const query = el.value.slice(next.from, el.selectionStart)
    if (dismissed.current === query) return close()
    dismissed.current = null
    setActive(next)
    setIndex((current) => (current < next.options.length ? current : 0))
    const caret = caretCoords(el, el.selectionStart)
    setPosition({ top: caret.top + caret.height, left: caret.left })
  }, [close, textareaRef])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): CompletionKeyResult => {
      if (!active || active.options.length === 0) return null
      const count = active.options.length
      switch (event.key) {
        case "ArrowDown":
          setIndex((i) => (i + 1) % count)
          return "handled"
        case "ArrowUp":
          setIndex((i) => (i - 1 + count) % count)
          return "handled"
        case "Enter":
        case "Tab": {
          const option = active.options[index] ?? active.options[0]
          close()
          return option.apply({ from: active.from, to: active.to })
        }
        case "Escape": {
          const el = textareaRef.current
          dismissed.current = el ? el.value.slice(active.from, el.selectionStart) : null
          close()
          return "handled"
        }
        default:
          return null
      }
    },
    [active, index, close, textareaRef],
  )

  /** Accept an option by index (mouse click). */
  const accept = useCallback(
    (optionIndex: number): CompletionApply | null => {
      if (!active) return null
      const option = active.options[optionIndex]
      if (!option) return null
      close()
      return option.apply({ from: active.from, to: active.to })
    },
    [active, close],
  )

  return { active, index, position, recompute, handleKeyDown, accept, close }
}
