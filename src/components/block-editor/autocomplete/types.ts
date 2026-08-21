import type { ReactNode } from "react"

/**
 * The block editor's **autocomplete layer**. A `CompletionSource` is a pure
 * function that inspects the text being edited and, when the caret sits in a
 * trigger context it recognises, returns the range it owns plus the options to
 * offer. This mirrors the command/keymap layering: behaviour lives in small,
 * greppable, unit-tested pieces, and new completions (notes via `[[`, tags via
 * `#`, templates, emoji, …) are added by writing another source — no changes to
 * the engine or the menu.
 *
 * Sources that share a trigger (e.g. `[[` for both dates and note links) are
 * merged by the engine, so a single `[[mon` menu can list a date *and* matching
 * notes together.
 */

/** What a source sees: the full block text and the caret offset within it. */
interface CompletionContext {
  text: string
  caret: number
}

/** A single, replaceable text edit produced by accepting an option. Offsets are
 * into the block text; `caret` is where the cursor lands afterwards. */
export interface CompletionApply {
  from: number
  to: number
  insert: string
  caret: number
}

/** One row in the menu. `apply` is computed against the match's range so a
 * source never has to re-locate the trigger. */
export interface CompletionOption {
  /** Stable id (unique within a match) for keying and selection. */
  id: string
  label: string
  /** Muted secondary text (e.g. "in 3 days"). */
  detail?: string
  icon?: ReactNode
  apply: (range: { from: number; to: number }) => CompletionApply
}

/** A source's answer: the trigger range it owns (used to anchor the menu and to
 * merge peer sources) and the options to show. `null` = not triggered here. */
export interface CompletionMatch {
  from: number
  to: number
  options: CompletionOption[]
}

export type CompletionSource = (context: CompletionContext) => CompletionMatch | null
