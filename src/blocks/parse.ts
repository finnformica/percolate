import { blockId } from "./id"
import type { Block, BlockDoc } from "./types"

/** A node in the intermediate tree, before ids are finalized. */
interface ParsedNode {
  content: string
  /** Id read from an `id::` line, if present. */
  fileId?: string
  children: ParsedNode[]
}

const ID_RE = /^\s*id::\s+(.+)$/

/**
 * Parse markdown into a BlockDoc.
 *
 * - Frontmatter (a leading `---` … `---` block) is preserved verbatim.
 * - Every non-blank, non-`id::` line is a block; its content is written
 *   verbatim (a bullet keeps its `- `, a heading its `# `, a paragraph nothing)
 *   and nesting comes from two-space indentation.
 * - An `id::` line immediately after a block attaches its id to that block;
 *   blocks without one are minted a fresh id (so plain/imported markdown gains
 *   stable ids on the next save).
 */
export function parse(markdown: string): BlockDoc {
  // Normalize line endings so Windows/GitHub CRLF never leaks into content/ids.
  const { frontmatter, body } = splitFrontmatter(markdown.replace(/\r\n/g, "\n"))
  const lines = body.split("\n")
  // Drop the single trailing empty line produced by the final newline.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()

  const roots: ParsedNode[] = []
  // Stack of open nodes with their indentation depth, nearest-last.
  const stack: { depth: number; node: ParsedNode }[] = []

  const insert = (depth: number, node: ParsedNode) => {
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].node.children.push(node)
    stack.push({ depth, node })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === "") {
      i += 1
      continue
    }

    const indent = line.length - line.trimStart().length

    const idMatch = ID_RE.exec(line)
    if (idMatch) {
      // Reached an `id::` line directly — the block's content line was empty.
      // The id sits two spaces deeper than its (empty) content line.
      const depth = Math.max(0, Math.floor((indent - 2) / 2))
      insert(depth, { content: "", children: [], fileId: idMatch[1].trim() })
      i += 1
      continue
    }

    const content = line.slice(indent)
    const depth = Math.floor(indent / 2)
    const node: ParsedNode = { content, children: [] }

    // An `id::` line immediately after belongs to this block.
    const next = i + 1 < lines.length ? lines[i + 1] : undefined
    const nextId = next !== undefined ? ID_RE.exec(next) : null
    if (nextId) {
      node.fileId = nextId[1].trim()
      i += 2
    } else {
      i += 1
    }

    insert(depth, node)
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
