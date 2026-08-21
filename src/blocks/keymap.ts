import { getBlockType, stripMarker } from "./block-type"
import type { CommandInput, CommandName, Mode } from "./commands"

/**
 * The block editor's **keymap**: a declarative table mapping a mode + key combo
 * (and, where it matters, the caret situation) to a command name. This table is
 * the human-readable spec of the editor's keyboard behaviour — greppable in one
 * place, unit-tested, and the thing that stops these personal conventions from
 * silently eroding over time.
 *
 * A future touch layer would sit beside this as a second table mapping gestures
 * (swipe-right → `indent`) to the same command names — no behaviour duplicated,
 * just a different set of bindings feeding the same command layer.
 *
 * Combos are normalised strings built by `comboFromEvent` — modifier order is
 * fixed (`Mod+Alt+Shift+Key`) so a binding string always matches. `Mod` is
 * Cmd/Ctrl. Some edit-mode keys (Enter, Backspace, arrows) depend on the caret,
 * so their bindings carry a `when` predicate; the resolver returns the first
 * binding whose combo *and* predicate match, letting several Enter behaviours
 * share the one key.
 */

type Predicate = (input: CommandInput) => boolean

interface Binding {
  mode: Mode
  combo: string
  command: CommandName
  /** Optional guard; when present the binding only applies if it returns true. */
  when?: Predicate
}

function contentOf(input: CommandInput): string {
  return input.doc.blocks[input.id]?.content ?? ""
}

const isEmptyListItem: Predicate = (input) => {
  const content = contentOf(input)
  const kind = getBlockType(content).kind
  const isList = kind === "bullet" || kind === "todo" || kind === "ordered"
  return isList && stripMarker(content).trim() === ""
}

const caretAtEnd: Predicate = ({ caret }) =>
  !!caret && caret.start === caret.end && caret.end === caret.value.length

const caretAtStart: Predicate = ({ caret }) => !!caret && caret.start === 0 && caret.end === 0

const hasMarker: Predicate = (input) => getBlockType(contentOf(input)).kind !== "paragraph"

const atStartWithMarker: Predicate = (input) => caretAtStart(input) && hasMarker(input)

/** Caret at the very start of an unmarked, empty block (Backspace merges up). */
const atStartEmpty: Predicate = (input) =>
  caretAtStart(input) && !hasMarker(input) && contentOf(input) === ""

const atFirstLine: Predicate = ({ caret }) => !!caret && caret.atFirstLine
const atLastLine: Predicate = ({ caret }) => !!caret && caret.atLastLine

/**
 * The binding table. Order matters only among bindings that share a mode+combo:
 * the first whose predicate passes wins (so the guarded Enter / Backspace
 * variants are listed before their unguarded fallback).
 */
export const KEYMAP: Binding[] = [
  // ── Select mode ────────────────────────────────────────────────────────
  { mode: "select", combo: "Enter", command: "enterEdit" },
  { mode: "select", combo: "Tab", command: "indent" },
  { mode: "select", combo: "Shift+Tab", command: "outdent" },
  { mode: "select", combo: "ArrowUp", command: "moveSelectionUp" },
  { mode: "select", combo: "ArrowDown", command: "moveSelectionDown" },
  { mode: "select", combo: "Backspace", command: "deleteBlock" },
  { mode: "select", combo: "Delete", command: "deleteBlock" },
  { mode: "select", combo: "x", command: "toggleTodo" },
  { mode: "select", combo: " ", command: "toggleCollapse" },

  // ── Edit mode ──────────────────────────────────────────────────────────
  { mode: "edit", combo: "Escape", command: "exitEdit" },
  { mode: "edit", combo: "Tab", command: "indent" },
  { mode: "edit", combo: "Shift+Tab", command: "outdent" },
  // Shift-Enter is a plain line break: split at the caret with no list marker.
  { mode: "edit", combo: "Shift+Enter", command: "splitPlain" },
  // Enter: empty list item exits the list; caret-at-end appends a fresh block;
  // otherwise split the line at the caret (carrying the list style).
  { mode: "edit", combo: "Enter", when: isEmptyListItem, command: "exitList" },
  { mode: "edit", combo: "Enter", when: caretAtEnd, command: "insertBelow" },
  { mode: "edit", combo: "Enter", command: "splitContinuingList" },
  // Backspace only leaves the textarea's control at the very start of a block.
  { mode: "edit", combo: "Backspace", when: atStartWithMarker, command: "stripMarker" },
  { mode: "edit", combo: "Backspace", when: atStartEmpty, command: "backspaceEmpty" },
  // Arrows leave the block only from its first / last visual line.
  { mode: "edit", combo: "ArrowUp", when: atFirstLine, command: "moveEditFocusUp" },
  { mode: "edit", combo: "ArrowDown", when: atLastLine, command: "moveEditFocusDown" },
]

/** Minimal shape of a keyboard event needed to build a combo. */
export interface KeyLike {
  key: string
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}

/** Normalise a key event to a combo string, e.g. `Shift+Tab`, `Mod+z`, `Enter`. */
export function comboFromEvent(event: KeyLike): string {
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push("Mod")
  if (event.altKey) parts.push("Alt")
  if (event.shiftKey) parts.push("Shift")
  parts.push(event.key)
  return parts.join("+")
}

/**
 * Resolve a mode + event to a command name, honouring `when` guards. Returns
 * `null` when nothing is bound (the caller then lets the event do its default,
 * e.g. ordinary typing).
 */
export function resolveKey(mode: Mode, event: KeyLike, input: CommandInput): CommandName | null {
  const combo = comboFromEvent(event)
  for (const binding of KEYMAP) {
    if (binding.mode !== mode) continue
    if (binding.combo !== combo) continue
    if (binding.when && !binding.when(input)) continue
    return binding.command
  }
  return null
}
