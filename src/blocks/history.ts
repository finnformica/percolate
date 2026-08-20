import type { BlockDoc } from "./types"

/**
 * A local, in-memory undo/redo history for the block editor. It records
 * snapshots of the whole document, so a single Cmd-Z can undo a change that
 * spanned several blocks — something the browser's per-textarea native undo
 * can't do.
 *
 * Consecutive text edits to the *same* block coalesce into one undo step (so
 * typing a word isn't undone one keystroke at a time), while structural
 * changes — inserting, deleting, indenting, switching type — are always their
 * own step. The history is collapsed on save (see `emptyHistory`), so undo
 * never reaches behind a committed state.
 */

/** Describes the change being recorded, used to decide coalescing. */
export type BlockOp = { type: "text"; blockId: string } | { type: "structural" }

export type History = {
  /** Snapshots to restore on undo, oldest first; the last is the most recent. */
  past: BlockDoc[]
  /** Snapshots to restore on redo, oldest first. */
  future: BlockDoc[]
  /** The last recorded op, for coalescing runs of edits to one block. */
  lastOp: BlockOp | null
}

/** How many undo steps to keep. */
const LIMIT = 200

export function emptyHistory(): History {
  return { past: [], future: [], lastOp: null }
}

/**
 * Record a change about to be applied. `current` is the document *before* the
 * change. Returns the new history (the caller then applies the next doc).
 */
export function record(history: History, current: BlockDoc, op: BlockOp): History {
  const coalesce =
    op.type === "text" && history.lastOp?.type === "text" && history.lastOp.blockId === op.blockId

  return {
    // A coalesced edit keeps the snapshot taken at the start of the run.
    past: coalesce ? history.past : [...history.past, current].slice(-LIMIT),
    // Any fresh change invalidates the redo stack.
    future: [],
    lastOp: op,
  }
}

/**
 * Undo one step. `current` is the live document (pushed onto the redo stack).
 * Returns the doc to restore and the new history, or `null` if nothing to undo.
 */
export function undo(
  history: History,
  current: BlockDoc,
): { history: History; doc: BlockDoc } | null {
  if (history.past.length === 0) return null
  const doc = history.past[history.past.length - 1]
  return {
    doc,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
      lastOp: null,
    },
  }
}

/** Redo one step, the mirror of {@link undo}. */
export function redo(
  history: History,
  current: BlockDoc,
): { history: History; doc: BlockDoc } | null {
  if (history.future.length === 0) return null
  const doc = history.future[history.future.length - 1]
  return {
    doc,
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
      lastOp: null,
    },
  }
}
