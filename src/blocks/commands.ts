import {
  getBlockType,
  stripMarker,
  toggleTodo as toggleTodoContent,
  type BlockType,
} from "./block-type"
import type { BlockOp } from "./history"
import {
  emptyBlock,
  indentBlock,
  insertAfter,
  moveBlock,
  outdentBlock,
  removeBlock,
  updateContent,
} from "./ops"
import type { BlockDoc } from "./types"

/**
 * The block editor's **command layer**: named, input-agnostic intents ("indent
 * this block", "delete this block", "split at the caret") expressed as pure
 * functions over the document.
 *
 * This is the seam every entry point calls into — the keyboard today (via the
 * keymap in `keymap.ts`), and touch gestures or a block menu tomorrow. A swipe
 * that indents a block dispatches the same `indent` command a Tab press does, so
 * the behaviour is defined once and never duplicated per input method.
 *
 * Commands are **pure**: they take the current doc plus a little UI context and
 * return a `CommandResult` describing what should change (a new doc, where focus
 * should land, whether a block's collapse toggles). The editor component owns
 * the actual state and applies the result — commands never touch React or the
 * DOM, which keeps them trivially testable.
 */

export type Mode = "select" | "edit"

/** Caret state read from the edit textarea, for caret-sensitive commands. */
export interface CaretInput {
  /** The visible body text (marker stripped) currently in the textarea. */
  value: string
  start: number
  end: number
  /** Whether the caret sits on the first / last visual line (for arrow-outs). */
  atFirstLine: boolean
  atLastLine: boolean
}

export interface CommandInput {
  doc: BlockDoc
  id: string
  mode: Mode
  /** On-screen order of visible block ids (collapsed children skipped). */
  visibleOrder: string[]
  /** Present in edit mode; absent in select mode. */
  caret?: CaretInput
}

/** Where selection / edit focus should land after a command runs. */
export type FocusIntent =
  | { mode: "select"; id: string | null }
  | { mode: "edit"; id: string; atStart?: boolean; caret?: number }

export interface CommandResult {
  /** Whether the command consumed the gesture (the caller preventDefaults). */
  handled: boolean
  /** New document, when structure or content changed. */
  doc?: BlockDoc
  /** History op describing the change (defaults to structural when `doc` set). */
  op?: BlockOp
  /** Requested focus / selection change. */
  focus?: FocusIntent
  /** Id whose collapse state should toggle. */
  toggleCollapse?: string
  /** Navigation tried to move above the first block — the caller may hand focus
   * to whatever sits above the editor (e.g. the note title). */
  exitTop?: boolean
}

type Command = (input: CommandInput) => CommandResult

const IGNORED: CommandResult = { handled: false }
const STRUCTURAL: BlockOp = { type: "structural" }

/** The block's own leading marker (`# `, `- `, `[ ] `, `> `, `1. `), or "". */
function markerPrefix(content: string): string {
  return content.slice(0, content.length - stripMarker(content).length)
}

/**
 * The marker a new sibling block should carry. Todo / ordered lists continue
 * their own type; everything else (paragraph, heading, quote, bullet) starts a
 * fresh unordered list item by default.
 */
function continuationMarker(type: BlockType): string {
  switch (type.kind) {
    case "todo":
      return "[ ] "
    case "ordered":
      return `${type.number + 1}. `
    default:
      return "- "
  }
}

/** Keep the current block focused, in whichever mode we're already in. */
function keepFocus(mode: Mode, id: string): FocusIntent {
  return mode === "edit" ? { mode: "edit", id } : { mode: "select", id }
}

/** Move the highlight to the previous / next visible block (select mode). */
function moveSelection(direction: "up" | "down"): Command {
  return ({ id, visibleOrder }) => {
    const i = visibleOrder.indexOf(id)
    if (i === -1) return { handled: true }
    const next = direction === "up" ? i - 1 : i + 1
    // Moving up past the first block hands focus to whatever's above the editor.
    if (next < 0) return { handled: true, exitTop: true }
    // Consume the key at the bottom too, so the page never scrolls instead.
    if (next >= visibleOrder.length) return { handled: true }
    return { handled: true, focus: { mode: "select", id: visibleOrder[next] } }
  }
}

/** Move edit focus to the adjacent block when an arrow leaves the current one. */
function moveEditFocus(direction: "up" | "down"): Command {
  return ({ id, visibleOrder }) => {
    const i = visibleOrder.indexOf(id)
    if (direction === "up") {
      if (i > 0) return { handled: true, focus: { mode: "edit", id: visibleOrder[i - 1] } }
      return { handled: true, exitTop: true }
    }
    if (i >= 0 && i < visibleOrder.length - 1) {
      return { handled: true, focus: { mode: "edit", id: visibleOrder[i + 1], atStart: true } }
    }
    return { handled: true }
  }
}

/** Split the block at the caret, giving the trailing text `marker` (a list
 * continuation for Enter, nothing for a plain Shift-Enter line break). */
function splitAtCaret(continueList: boolean): Command {
  return ({ doc, id, caret }) => {
    if (!caret) return IGNORED
    const content = doc.blocks[id]?.content ?? ""
    const type = getBlockType(content)
    const prefix = markerPrefix(content)
    const before = caret.value.slice(0, caret.start)
    const after = caret.value.slice(caret.end)
    const marker = continueList ? continuationMarker(type) : ""
    const updated = updateContent(doc, id, prefix + before)
    const fresh = emptyBlock(marker + after)
    const next = insertAfter(updated, id, fresh)
    return {
      handled: true,
      doc: next,
      op: STRUCTURAL,
      focus: { mode: "edit", id: fresh.id, atStart: true },
    }
  }
}

export type CommandName =
  | "enterEdit"
  | "exitEdit"
  | "indent"
  | "outdent"
  | "moveSelectionUp"
  | "moveSelectionDown"
  | "moveEditFocusUp"
  | "moveEditFocusDown"
  | "moveBlockUp"
  | "moveBlockDown"
  | "deleteBlock"
  | "toggleTodo"
  | "toggleCollapse"
  | "insertBelow"
  | "splitContinuingList"
  | "splitPlain"
  | "exitList"
  | "stripMarker"
  | "backspaceEmpty"

export const COMMANDS: Record<CommandName, Command> = {
  /** Select → edit the highlighted block. */
  enterEdit: ({ id }) => ({ handled: true, focus: { mode: "edit", id } }),

  /** Edit → back to highlighting the block. */
  exitEdit: ({ id }) => ({ handled: true, focus: { mode: "select", id } }),

  /** Nest the block under its previous sibling; keeps the current mode/focus. */
  indent: ({ doc, id, mode }) => {
    const next = indentBlock(doc, id)
    // Consume the key even when it can't indent (no previous sibling), so Tab
    // never escapes the editor.
    if (next === doc) return { handled: true }
    return { handled: true, doc: next, op: STRUCTURAL, focus: keepFocus(mode, id) }
  },

  /** Lift the block out to become a sibling of its parent. */
  outdent: ({ doc, id, mode }) => {
    const next = outdentBlock(doc, id)
    if (next === doc) return { handled: true }
    return { handled: true, doc: next, op: STRUCTURAL, focus: keepFocus(mode, id) }
  },

  moveSelectionUp: moveSelection("up"),
  moveSelectionDown: moveSelection("down"),
  moveEditFocusUp: moveEditFocus("up"),
  moveEditFocusDown: moveEditFocus("down"),

  /** Reorder the block among its siblings (subtree comes along). */
  moveBlockUp: ({ doc, id, mode }) => {
    const next = moveBlock(doc, id, "up")
    if (next === doc) return { handled: true }
    return { handled: true, doc: next, op: STRUCTURAL, focus: keepFocus(mode, id) }
  },
  moveBlockDown: ({ doc, id, mode }) => {
    const next = moveBlock(doc, id, "down")
    if (next === doc) return { handled: true }
    return { handled: true, doc: next, op: STRUCTURAL, focus: keepFocus(mode, id) }
  },

  /** Delete the highlighted block and its subtree (select mode). */
  deleteBlock: ({ doc, id }) => {
    const onlyBlock =
      doc.rootBlockIds.length === 1 &&
      doc.rootBlockIds[0] === id &&
      (doc.blocks[id]?.children.length ?? 0) === 0
    if (onlyBlock) return { handled: true }
    const { doc: next, focusId } = removeBlock(doc, id)
    return {
      handled: true,
      doc: next,
      op: STRUCTURAL,
      focus: { mode: "select", id: focusId ?? next.rootBlockIds[0] ?? null },
    }
  },

  /** Toggle a todo's checkbox from select mode (no-op on other blocks). */
  toggleTodo: ({ doc, id, mode }) => {
    const content = doc.blocks[id]?.content ?? ""
    if (getBlockType(content).kind !== "todo") return IGNORED
    return {
      handled: true,
      doc: updateContent(doc, id, toggleTodoContent(content)),
      op: { type: "text", blockId: id },
      focus: keepFocus(mode, id),
    }
  },

  /** Collapse / expand a block with children; consumes Space regardless (so the
   * page never scrolls) but only toggles when there's something to fold. */
  toggleCollapse: ({ doc, id }) => {
    const hasChildren = (doc.blocks[id]?.children.length ?? 0) > 0
    if (!hasChildren) return { handled: true }
    return { handled: true, toggleCollapse: id }
  },

  /** Enter at end of line: a fresh continuation block below. Enter from a
   * heading nests the new block under it, like an outline section. */
  insertBelow: ({ doc, id }) => {
    const content = doc.blocks[id]?.content ?? ""
    const type = getBlockType(content)
    const fresh = emptyBlock(continuationMarker(type))
    let next = insertAfter(doc, id, fresh)
    if (type.kind === "heading") next = indentBlock(next, fresh.id)
    return { handled: true, doc: next, op: STRUCTURAL, focus: { mode: "edit", id: fresh.id } }
  },

  splitContinuingList: splitAtCaret(true),
  splitPlain: splitAtCaret(false),

  /** Enter on an empty list item exits the list (becomes a paragraph). */
  exitList: ({ doc, id }) => ({
    handled: true,
    doc: updateContent(doc, id, ""),
    op: { type: "text", blockId: id },
    focus: { mode: "edit", id },
  }),

  /** Backspace at the start of a marked block strips its marker (→ paragraph). */
  stripMarker: ({ doc, id }) => {
    const content = doc.blocks[id]?.content ?? ""
    return {
      handled: true,
      doc: updateContent(doc, id, stripMarker(content)),
      op: { type: "text", blockId: id },
      focus: { mode: "edit", id, atStart: true },
    }
  },

  /** Backspace at the start of an empty block removes it, merging upward. */
  backspaceEmpty: ({ doc, id }) => {
    if (doc.rootBlockIds.length === 1 && doc.rootBlockIds[0] === id) return { handled: true }
    const { doc: next, focusId } = removeBlock(doc, id)
    return {
      handled: true,
      doc: next,
      op: STRUCTURAL,
      focus: focusId
        ? { mode: "edit", id: focusId }
        : { mode: "select", id: next.rootBlockIds[0] ?? null },
    }
  },
}

/** Run a named command. Unknown names are a no-op (defensive). */
export function runCommand(name: CommandName, input: CommandInput): CommandResult {
  const command = COMMANDS[name]
  return command ? command(input) : IGNORED
}
