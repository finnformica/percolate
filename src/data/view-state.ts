import { atom, useAtomValue } from "jotai"
import { selectAtom, useAtomCallback } from "jotai/utils"
import React from "react"
import { markdownFilesAtom } from "../global-state"
import { VIEW_STATE_PATH } from "./paths"
import { useWriteFiles } from "./store"
import { parseViewState } from "./view-state-parse"

/**
 * Per-note view state, derived from the tracked `.ruminate/view-state.json`
 * sidecar. The sidecar rides the same git sync as notes, so this persists
 * across reloads and devices, but it is kept out of note content so folding a
 * block never rewrites a note file.
 */
const viewStateAtom = atom((get) => parseViewState(get(markdownFilesAtom)[VIEW_STATE_PATH]))

const EMPTY: string[] = []

/**
 * Collapse state for one note: the set of collapsed block ids plus a toggle.
 *
 * Seeds from the synced sidecar on mount (the note page remounts per note, so a
 * fresh seed happens on every navigation). Toggles update local state
 * immediately for a snappy UI, and are persisted debounced (1s) — a burst of
 * folds collapses into a single commit. A pending write is flushed on unmount
 * so navigating away never drops the last fold.
 */
export function useCollapseState(noteId: string | undefined) {
  const persistedAtom = React.useMemo(
    () => selectAtom(viewStateAtom, (vs) => (noteId ? (vs[noteId] ?? EMPTY) : EMPTY)),
    [noteId],
  )
  const persisted = useAtomValue(persistedAtom)

  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(persisted))

  const writeFiles = useWriteFiles()
  const getViewState = useAtomCallback(React.useCallback((get) => get(viewStateAtom), []))

  // Keep the latest set in a ref so the debounced flush reads current state.
  const latest = React.useRef(collapsed)
  latest.current = collapsed
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(() => {
    timer.current = null
    if (!noteId) return
    const all = getViewState()
    const ids = [...latest.current]
    const next = { ...all }
    if (ids.length > 0) next[noteId] = ids
    else delete next[noteId]
    writeFiles({ [VIEW_STATE_PATH]: JSON.stringify(next, null, 2) }, "Update view state")
  }, [noteId, getViewState, writeFiles])

  const toggleCollapse = React.useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 1000)
    },
    [flush],
  )

  // Flush any pending write when the note unmounts (navigation) so the last
  // toggle within the debounce window is not lost.
  const flushRef = React.useRef(flush)
  flushRef.current = flush
  React.useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        flushRef.current()
      }
    },
    [],
  )

  return { collapsed, toggleCollapse }
}
