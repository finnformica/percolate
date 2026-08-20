import { blockId } from "./id"
import type { Block, BlockDoc } from "./types"

/** A node in the intermediate tree, before ids are finalized. */
interface ParsedNode {
  content: string
  /** Id read from an `id::` line, if present. */
  fileId?: string
  children: ParsedNode[]
}

const BULLET_RE = /^(\s*)-\s?(.*)$/
const ID_RE = /^\s*id::\s+(.+)\s*$/

/**
 * Parse Logseq-style markdown into a BlockDoc.
 *
 * - Frontmatter (a leading `---` … `---` block) is preserved verbatim.
 * - Outline bullets (`- …`, nested by two-space indentation) become blocks.
 * - An `id::` line attaches its id to the block above it; blocks without one
 *   are minted a fresh id (so plain/imported markdown gains stable ids on the
 *   next save).
 * - Any non-bullet, non-`id::` line is treated as a top-level block whose
 *   content is that line (best-effort import of non-outline notes).
 */
export function parse(markdown: string): BlockDoc {
  // Normalize line endings up front so Windows/GitHub CRLF never leaks into a
  // block's content or an `id::` value (which would break refs and round-trip).
  const { frontmatter, body } = splitFrontmatter(markdown.replace(/\r\n/g, "\n"))
  const lines = body.split("\n")

  const roots: ParsedNode[] = []
  // Stack of open nodes with their indentation depth, nearest-last.
  const stack: { depth: number; node: ParsedNode }[] = []
  let last: ParsedNode | null = null

  for (const raw of lines) {
    if (raw.trim() === "") continue

    const idMatch = raw.match(ID_RE)
    if (idMatch && last) {
      last.fileId = idMatch[1].trim()
      continue
    }

    const bulletMatch = raw.match(BULLET_RE)
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2)
      const node: ParsedNode = { content: bulletMatch[2], children: [] }
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop()
      }
      if (stack.length === 0) roots.push(node)
      else stack[stack.length - 1].node.children.push(node)
      stack.push({ depth, node })
      last = node
    } else {
      // Non-outline line: treat as a standalone top-level block.
      const node: ParsedNode = { content: raw.trim(), children: [] }
      roots.push(node)
      stack.length = 0
      last = node
    }
  }

  const blocks: Record<string, Block> = {}
  const flatten = (node: ParsedNode): string => {
    const id = node.fileId ?? blockId()
    const block: Block = { id, content: node.content, children: [] }
    blocks[id] = block
    block.children = node.children.map(flatten)
    return id
  }
  const rootBlockIds = roots.map(flatten)

  return { frontmatter, rootBlockIds, blocks }
}

/** Split a leading YAML frontmatter block from the body, keeping it verbatim. */
function splitFrontmatter(markdown: string): {
  frontmatter: string | null
  body: string
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: markdown }
  return { frontmatter: match[1], body: match[2] }
}
