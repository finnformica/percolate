import { parseDate } from "chrono-node"
import { formatDate, formatDateDistance, toDateString } from "../../../utils/date"
import { CalendarDateIcon16 } from "../../icons"
import type { CompletionSource } from "./types"

/** Query text after `[[`, up to the caret, excluding `]` and `|`. */
const TRIGGER = /\[\[([^[\]|]*)$/

/**
 * Natural-language date completions inside a wikilink. Typing `[[next monday`
 * offers the resolved daily-note link (ported from the classic CodeMirror
 * editor's `dateCompletion`). Because it's an opt-in suggestion — the user
 * presses Enter to accept — chrono's greediness ("May", "wed") can't clobber a
 * real note: an unwanted suggestion is simply ignored.
 */
export const dateCompletionSource: CompletionSource = ({ text, caret }) => {
  const match = TRIGGER.exec(text.slice(0, caret))
  if (!match) return null

  const query = match[1]
  if (!query.trim()) return null

  const date = parseDate(query)
  if (!date) return null

  const dateString = toDateString(date)
  // Already a plain `[[YYYY-MM-DD` — nothing to resolve.
  if (query === dateString) return null

  const from = match.index
  // Swallow an existing `]]` right after the caret so we don't double it.
  const to = text.slice(caret, caret + 2) === "]]" ? caret + 2 : caret

  return {
    from,
    to,
    options: [
      {
        id: `date:${dateString}`,
        label: formatDate(dateString),
        detail: formatDateDistance(dateString),
        icon: <CalendarDateIcon16 date={date.getDate()} />,
        apply: (range) => {
          const insert = `[[${dateString}]]`
          return { from: range.from, to: range.to, insert, caret: range.from + insert.length }
        },
      },
    ],
  }
}
