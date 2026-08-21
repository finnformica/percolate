/**
 * Pure parsing for the view-state sidecar.
 *
 * Kept free of app/state imports so it can be unit-tested without pulling in
 * the global state machine (and its browser-only filesystem).
 */

/** View state keyed by note id: currently the ids of that note's collapsed blocks. */
export type ViewState = Record<string, string[]>

/**
 * Parse the raw `.ruminate/view-state.json` contents into a `ViewState`.
 * Tolerant by design — missing or malformed JSON, and entries of the wrong
 * shape, degrade to empty rather than throwing, so a corrupt sidecar can never
 * break the editor.
 */
export function parseViewState(raw: string | undefined): ViewState {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const result: ViewState = {}
    for (const [noteId, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) {
        result[noteId] = ids.filter((x): x is string => typeof x === "string")
      }
    }
    return result
  } catch {
    return {}
  }
}
