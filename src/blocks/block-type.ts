/**
 * A block's *type* is derived from its markdown content at render time (never
 * stored). This is what lets `# `, `- `, `[ ] ` behave like Notion shortcuts:
 * the content is the source of truth, and the editor styles/marks each block
 * from the leading token.
 */
export type BlockType =
  | { kind: "heading"; level: number }
  | { kind: "todo"; checked: boolean }
  | { kind: "quote" }
  | { kind: "bullet" }
  | { kind: "paragraph" }

const HEADING_RE = /^(#{1,6})\s+/
// Accepts `[ ]`, `[x]`, `[X]`, and the shorthand `[]`.
const TODO_RE = /^\[([ xX]?)\]\s+/
const QUOTE_RE = /^>\s+/
const BULLET_RE = /^[-*]\s+/

export function getBlockType(content: string): BlockType {
  const heading = HEADING_RE.exec(content)
  if (heading) return { kind: "heading", level: heading[1].length }

  const todo = TODO_RE.exec(content)
  if (todo) return { kind: "todo", checked: todo[1].toLowerCase() === "x" }

  if (QUOTE_RE.test(content)) return { kind: "quote" }
  if (BULLET_RE.test(content)) return { kind: "bullet" }

  return { kind: "paragraph" }
}

/** The block's text with its leading marker (`# `, `- `, `[ ] `, `> `) removed. */
export function stripMarker(content: string): string {
  const type = getBlockType(content)
  switch (type.kind) {
    case "heading":
      return content.replace(HEADING_RE, "")
    case "todo":
      return content.replace(TODO_RE, "")
    case "quote":
      return content.replace(QUOTE_RE, "")
    case "bullet":
      return content.replace(BULLET_RE, "")
    default:
      return content
  }
}

/** Toggle a todo block's checkbox, returning the new content. */
export function toggleTodo(content: string): string {
  const type = getBlockType(content)
  if (type.kind !== "todo") return content
  return type.checked ? content.replace(/^\[[xX]\]/, "[ ]") : content.replace(/^\[[ ]?\]/, "[x]")
}
