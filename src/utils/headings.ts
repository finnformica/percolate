export interface Heading {
  level: number
  text: string
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

/**
 * Extract the ATX headings (`# …` … `###### …`) from a note's markdown, in
 * document order. Frontmatter is skipped so a `---` fence is never mistaken
 * for content. Used to list a note's headings as children in the command menu.
 */
export function getHeadings(content: string): Heading[] {
  const body = content.replace(FRONTMATTER_RE, "")
  const headings: Heading[] = []
  for (const line of body.split("\n")) {
    const match = HEADING_RE.exec(line)
    if (match) headings.push({ level: match[1].length, text: match[2].trim() })
  }
  return headings
}
