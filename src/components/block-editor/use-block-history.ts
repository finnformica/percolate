import { useCallback, useRef } from "react"
import { emptyHistory, record, redo, undo, type BlockOp } from "../../blocks/history"
import type { BlockDoc } from "../../blocks/types"

/**
 * Wraps the block editor's `onChange` with a document-level undo/redo history.
 *
 * - `commit(current, next, op)` records `current` then applies `next`.
 * - `undo()` / `redo()` restore a snapshot (and return it, or `null`).
 * - The history lives for the editor's lifetime (it resets only when the note
 *   changes and the editor remounts), so undo/redo keep working across saves.
 */
export function useBlockHistory(onChange: (doc: BlockDoc) => void) {
  const historyRef = useRef(emptyHistory())

  const commit = useCallback(
    (current: BlockDoc, next: BlockDoc, op: BlockOp) => {
      historyRef.current = record(historyRef.current, current, op)
      onChange(next)
    },
    [onChange],
  )

  const undoChange = useCallback(
    (current: BlockDoc): BlockDoc | null => {
      const result = undo(historyRef.current, current)
      if (!result) return null
      historyRef.current = result.history
      onChange(result.doc)
      return result.doc
    },
    [onChange],
  )

  const redoChange = useCallback(
    (current: BlockDoc): BlockDoc | null => {
      const result = redo(historyRef.current, current)
      if (!result) return null
      historyRef.current = result.history
      onChange(result.doc)
      return result.doc
    },
    [onChange],
  )

  return { commit, undo: undoChange, redo: redoChange }
}
