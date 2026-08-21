import { useAtomValue } from "jotai"
import React from "react"
import type { FullOptions, Searcher as FuzzySearcher } from "fast-fuzzy"
import { noteSearcherAtom, sortedNotesAtom } from "../global-state"
import { parseQuery } from "../utils/search"
import { filterNotes, sortNotes } from "../utils/search-notes"
import type { Note } from "../schema"

// Shared search routine used by both hooks
function runSearch(
  query: string,
  sortedNotes: Note[],
  noteSearcher: FuzzySearcher<Note, FullOptions<Note>>,
) {
  if (!query) return sortedNotes
  const { fuzzy, filters, sorts } = parseQuery(query)
  const results = fuzzy ? noteSearcher.search(fuzzy) : sortedNotes
  const filtered = filterNotes(results, filters)
  return sorts.length ? sortNotes(filtered, sorts) : filtered
}

export function useSearchNotes() {
  const sortedNotes = useAtomValue(sortedNotesAtom)
  const noteSearcher = useAtomValue(noteSearcherAtom)

  const searchNotes = React.useCallback(
    (query: string) => {
      return runSearch(query, sortedNotes, noteSearcher)
    },
    [sortedNotes, noteSearcher],
  )

  return searchNotes
}
