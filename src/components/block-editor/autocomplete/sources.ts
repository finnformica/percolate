import { dateCompletionSource } from "./date-source"
import type { CompletionSource } from "./types"

/**
 * The ordered list of completion sources the editor offers. This is the single
 * place new autocomplete behaviour is registered — the roadmap from the block
 * editor parity backlog plugs in here:
 *
 *   - `[[` note links  → a `noteCompletionSource` (search existing notes)
 *   - `#`  tags        → a `tagCompletionSource`
 *   - template names   → a `templateCompletionSource`
 *
 * Order only matters among sources that share a trigger and produce different
 * `to` ranges; the engine merges peers at the same anchor.
 */
export const COMPLETION_SOURCES: readonly CompletionSource[] = [dateCompletionSource]
