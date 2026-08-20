/**
 * The block model for Ruminate's editor.
 *
 * A note is parsed from Logseq-style markdown into a flat map of blocks plus an
 * ordered list of root ids (the outline tree lives in each block's `children`).
 * Markdown files in the GitHub repo stay the source of truth; this structure is
 * the derived, editable representation.
 *
 * A block's `content` is raw markdown (rendered per-block, Pensive-style). The
 * block's *type* (heading, todo, quote, …) is intentionally NOT stored — it's
 * derived from the content at render time (`# `, `[ ] `, `> `), which keeps
 * serialization trivial and round-trip-safe.
 */
type BlockId = string

export interface Block {
  id: BlockId
  /** Raw markdown for this block only (no children, no `id::` line). */
  content: string
  /** Ordered ids of child blocks. */
  children: BlockId[]
}

export interface BlockDoc {
  /**
   * The raw text *between* the `---` frontmatter fences, preserved verbatim
   * (never re-serialized), or null if the note has no frontmatter. Keeping it
   * byte-for-byte means block editing can never corrupt YAML it didn't author.
   */
  frontmatter: string | null
  /** Top-level block ids, in order. */
  rootBlockIds: BlockId[]
  /** Every block in the note, keyed by id. */
  blocks: Record<BlockId, Block>
}
