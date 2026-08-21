import copy from "copy-to-clipboard"
import { toDisplayMarkdown } from "../blocks/to-display-markdown"

/**
 * The single path for copying note/block content to the clipboard. Always
 * converts the on-disk block format (id:: lines, bare `[ ]` todos) into clean
 * display markdown first, so no copy action ever leaks raw block metadata.
 */
export function copyAsMarkdown(content: string): void {
  copy(toDisplayMarkdown(content))
}
