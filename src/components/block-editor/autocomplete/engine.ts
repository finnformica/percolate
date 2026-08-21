import type { CompletionMatch, CompletionOption, CompletionSource } from "./types"

/** The active menu: where it's anchored (for positioning + replacing) and the
 * merged options from every source triggered at that anchor. */
export interface ActiveCompletion {
  from: number
  to: number
  options: CompletionOption[]
}

/**
 * Query every source and combine their answers into at most one active menu.
 *
 * Sources triggered at the *same* anchor are merged (dates + note links under a
 * shared `[[`); when triggers differ we take the one nearest the caret (largest
 * `from`), so a `#tag` context wins over a stray earlier `[[`. Returns null when
 * nothing is triggered.
 */
export function queryCompletions(
  text: string,
  caret: number,
  sources: readonly CompletionSource[],
): ActiveCompletion | null {
  const matches: CompletionMatch[] = []
  for (const source of sources) {
    const match = source({ text, caret })
    if (match && match.options.length > 0) matches.push(match)
  }
  if (matches.length === 0) return null

  // The trigger closest to the caret wins; peers at that same anchor merge.
  const anchor = Math.max(...matches.map((match) => match.from))
  const active = matches.filter((match) => match.from === anchor)
  const to = Math.max(...active.map((match) => match.to))
  const options = active.flatMap((match) => match.options)

  return { from: anchor, to, options }
}
