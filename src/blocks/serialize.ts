import type { Block, BlockDoc } from "./types"

/**
 * Serialize a BlockDoc to Logseq-style markdown — the canonical on-disk form
 * that gets committed to the GitHub repo.
 *
 *   ---
 *   title: My note
 *   ---
 *   - A block
 *     id:: blk_abc
 *     - A nested block
 *       id:: blk_def
 *
 * Indentation is two spaces per depth; each block's id is written as an
 * `id::` property line directly beneath its content.
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
    lines.push(block.content ? `${indent}- ${block.content}` : `${indent}-`)
    lines.push(`${indent}  id:: ${block.id}`)
    for (const childId of block.children) walk(childId, depth + 1)
  }

  for (const id of doc.rootBlockIds) walk(id, 0)

  return lines.join("\n") + "\n"
}
