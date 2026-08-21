/**
 * Repo-relative path of the synced view-state sidecar.
 *
 * View state (e.g. which blocks are collapsed) is per-note UI state, kept in
 * `.ruminate/` — separate from note content — so folding a block never rewrites
 * a note file. It rides the same git sync as notes but is filtered out of the
 * note pipeline (see `notesAtom` and `noteContentsAtom`).
 */
export const VIEW_STATE_PATH = ".ruminate/view-state.json"
