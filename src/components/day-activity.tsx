import React from "react"
import { useDayActivity } from "../data/history"
import type { ChangedNote, DayCommit } from "../data/history-parse"
import { formatTimeOfDay } from "../utils/date"
import { LoadingIcon16 } from "./icons"
import { MarkdownContent } from "./markdown"
import { NoteLink } from "./note-link"

/**
 * Read-only "what was written that day" view for a past calendar date,
 * reconstructed from git history via GitHub. Rendered instead of the editable
 * daily note when the date is not today.
 */
export function DayActivity({ date }: { date: string }) {
  const state = useDayActivity(date)

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <LoadingIcon16 />
        Loading what was written…
      </div>
    )
  }

  if (state.status === "offline") {
    return <Message>History for past days isn’t available offline.</Message>
  }

  if (state.status === "error") {
    return <Message>Couldn’t load history: {state.message}</Message>
  }

  if (state.status === "empty") {
    return <Message>Nothing was written on this day.</Message>
  }

  const { notes, commits } = state.data

  // The daily note for this date reads like a journal, so surface it first;
  // everything else follows in the order GitHub returned.
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.noteId === date) return -1
    if (b.noteId === date) return 1
    return 0
  })

  return (
    <div className="flex flex-col gap-8">
      {sortedNotes.length === 0 ? (
        <Message>Nothing was written on this day.</Message>
      ) : (
        sortedNotes.map((note) => <ChangedNoteSection key={note.noteId} note={note} />)
      )}
      {commits.length > 0 ? <CommitTimeline commits={commits} /> : null}
    </div>
  )
}

function ChangedNoteSection({ note }: { note: ChangedNote }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-content font-bold">
        <NoteLink id={note.noteId} />
      </h2>
      {note.addedText ? (
        <MarkdownContent>{note.addedText}</MarkdownContent>
      ) : (
        <p className="italic text-text-secondary">{statusLabel(note.status)}</p>
      )}
    </section>
  )
}

function CommitTimeline({ commits }: { commits: DayCommit[] }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border-secondary pt-4">
      <h2 className="text-sm font-bold text-text-secondary">
        {commits.length} {commits.length === 1 ? "change" : "changes"} this day
      </h2>
      <ul className="flex flex-col gap-1">
        {commits.map((commit) => (
          <li key={commit.sha} className="flex gap-3 text-sm text-text-secondary">
            <span className="tabular-nums">{commit.date ? formatTimeOfDay(commit.date) : ""}</span>
            <span className="truncate">{firstLine(commit.message)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="text-text-secondary">{children}</p>
}

function statusLabel(status: string): string {
  switch (status) {
    case "removed":
      return "Removed this day"
    case "renamed":
      return "Renamed this day"
    default:
      return "Changed this day"
  }
}

function firstLine(message: string): string {
  return message.split("\n")[0]
}
