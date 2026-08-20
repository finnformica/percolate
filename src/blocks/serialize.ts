import type { Block, BlockDoc } from "./types"

/**
 * Serialize a BlockDoc to markdown — the canonical on-disk form committed to
 * the GitHub repo.
 *
 *   ---
 *   title: My note
 *   ---
 *   # A heading
 *     id:: blk_abc
 *   - A bullet
 *     id:: blk_def
 *   A plain paragraph
 *     id:: blk_ghi
 *
 * Each block's content is written *directly* (so a bullet keeps its single
 * `- `, a paragraph has no marker, a heading keeps `# `), followed by an
 * `id::` line indented two spaces further. Nesting is two spaces of indent per
 * depth. Writing the content verbatim — rather than wrapping every block in a
 * `- ` outline marker — keeps the markdown clean and lets blocks be real
 * paragraphs/headings, not just list items.
 */
export function serialize(doc: BlockDoc): string {
  const lines: string[] = []

  if (doc.frontmatter !== null) {
    lines.push("---")
    lines.push(doc.frontmatter)
    lines.push("---")
  }

  const walk = (id: string, depth: number) => {
    const block: Block | undefined = doc.blocks[id]
    if (!block) return
    const indent = "  ".repeat(depth)
    // The content line (empty content → just the indent, so depth is preserved).
    lines.push(`${indent}${block.content}`)
    lines.push(`${indent}  id:: ${block.id}`)
    for (const childId of block.children) walk(childId, depth + 1)
  }

  for (const id of doc.rootBlockIds) walk(id, 0)

  return lines.join("\n") + "\n"
}
