/**
 * Pure parsing/mapping for the calendar day-activity view.
 *
 * Kept free of network and app-state imports so it can be unit-tested without
 * pulling in Octokit or the global state machine.
 */

/** A repo file as returned by the GitHub compare / commit-detail endpoints. */
export type GhFile = {
  filename: string
  status: string
  patch?: string
}

/** A note changed on a given day, with the content added that day. */
export type ChangedNote = {
  noteId: string
  /** GitHub file status: "added" | "modified" | "removed" | "renamed" | … */
  status: string
  /** Lines added that day, rendered as "what was written". Empty for pure removals/renames. */
  addedText: string
  /** The raw unified-diff patch, if GitHub provided one. */
  patch?: string
}

/** A commit made on the day, for the timeline. */
export type DayCommit = {
  sha: string
  message: string
  /** Absolute ISO instant (author date). */
  date: string
}

/** The reconstructed activity for a single calendar day. */
export type DayActivity = {
  notes: ChangedNote[]
  commits: DayCommit[]
}

/**
 * The lines added in a unified-diff patch, with the leading `+` removed. Skips
 * the `+++` file header. Returns "" when there is no patch (binary, too large,
 * or a pure rename).
 */
export function extractAddedLines(patch: string | undefined): string {
  if (!patch) return ""
  return patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n")
    .trim()
}

/** A repo file is a note iff it is a top-level-or-nested `.md` file. */
function isNoteFile(filename: string): boolean {
  return filename.endsWith(".md")
}

/**
 * Map changed repo files to notes, dropping non-note files (e.g. the
 * `.ruminate/` view-state sidecar), and extracting the day's added text.
 */
export function filesToChangedNotes(files: GhFile[]): ChangedNote[] {
  return files
    .filter((file) => isNoteFile(file.filename))
    .map((file) => ({
      noteId: file.filename.replace(/\.md$/, ""),
      status: file.status,
      addedText: extractAddedLines(file.patch),
      patch: file.patch,
    }))
}
