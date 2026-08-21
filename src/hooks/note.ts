import { useAtomValue } from "jotai"
import { selectAtom, useAtomCallback } from "jotai/utils"
import React from "react"
import { backlinksIndexAtom, githubRepoAtom, githubUserAtom, notesAtom } from "../global-state"
import { useDeleteNoteFile, useGetNoteContents, useWriteNotes } from "../data/store"
import { Note, NoteId } from "../schema"
import { parseFrontmatter, updateFrontmatterValue } from "../utils/frontmatter"
import { deleteGist, updateGist } from "../utils/gist"
import { parseNote } from "../utils/parse-note"
import { updateWikilinks } from "../utils/update-wikilinks"
import { isValidNoteId } from "../utils/note-id"

const EMPTY_BACKLINKS: NoteId[] = []

const shallowEqualBacklinks = (a: NoteId[], b: NoteId[]) => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function useNoteById(id: NoteId | undefined) {
  const noteAtom = React.useMemo(
    () => selectAtom(notesAtom, (notes) => (id ? notes.get(id) : undefined)),
    [id],
  )
  const note = useAtomValue(noteAtom)
  return note
}

/** Get backlinks for any note ID, even if the note doesn't exist */
export function useBacklinksForId(id: NoteId | undefined) {
  const backlinksAtom = React.useMemo(
    () =>
      selectAtom(
        backlinksIndexAtom,
        (index) => (id ? (index.get(id) ?? EMPTY_BACKLINKS) : EMPTY_BACKLINKS),
        shallowEqualBacklinks,
      ),
    [id],
  )
  return useAtomValue(backlinksAtom)
}

export function useSaveNote() {
  const writeNotes = useWriteNotes()
  const githubUser = useAtomValue(githubUserAtom)
  const githubRepo = useAtomValue(githubRepoAtom)
  const getNotes = useAtomCallback(React.useCallback((get) => get(notesAtom), []))

  const saveNote = React.useCallback(
    async ({ id, content }: Pick<Note, "id" | "content">) => {
      // Add updated_at timestamp to frontmatter
      const contentWithTimestamp = updateFrontmatterValue({
        content,
        properties: { updated_at: new Date() },
      })

      writeNotes({ [id]: contentWithTimestamp })

      // If the note has a gist ID, update the gist
      const { frontmatter } = parseFrontmatter(contentWithTimestamp)
      if (typeof frontmatter.gist_id === "string" && githubUser && githubRepo) {
        await updateGist({
          gistId: frontmatter.gist_id,
          note: parseNote(id ?? "", contentWithTimestamp),
          githubUser,
          githubRepo,
          notes: getNotes(),
        })
      }
    },
    [writeNotes, githubUser, githubRepo, getNotes],
  )

  return saveNote
}

type RenameNoteResult =
  | { success: true }
  | { success: false; reason: "duplicate" | "invalid" | "no-op" }

export function useRenameNote() {
  const getNoteContents = useGetNoteContents()
  const writeNotes = useWriteNotes()

  return React.useCallback(
    (params: { oldName: string; newName: string; content: string }): RenameNoteResult => {
      const { oldName, newName, content } = params

      const noteContents = getNoteContents()

      // Guard against no-op renames
      if (!oldName || !newName || oldName === newName) {
        return { success: false, reason: "no-op" }
      }

      if (!isValidNoteId(newName)) {
        return { success: false, reason: "invalid" }
      }

      // Prevent overwriting an existing note
      if (noteContents[newName]) {
        return { success: false, reason: "duplicate" }
      }

      const oldNoteExists = Object.prototype.hasOwnProperty.call(noteContents, oldName)

      const updates: Record<string, string | null> = {}

      // Update wikilinks in all other notes
      for (const [id, noteContent] of Object.entries(noteContents)) {
        if (id === oldName) continue
        const newContent = updateWikilinks({
          fileContent: noteContent,
          oldId: oldName,
          newId: newName,
        })
        if (newContent !== noteContent) {
          updates[id] = newContent
        }
      }

      // Write the renamed note and mark the old id for deletion
      updates[newName] = updateWikilinks({
        fileContent: content,
        oldId: oldName,
        newId: newName,
      })
      if (oldNoteExists) {
        updates[oldName] = null
      }

      if (Object.keys(updates).length > 0) {
        writeNotes(updates, `Rename note ${oldName} to ${newName}`)
      }

      return { success: true }
    },
    [getNoteContents, writeNotes],
  )
}

export function useDeleteNote() {
  const deleteNoteFile = useDeleteNoteFile()
  const githubUser = useAtomValue(githubUserAtom)
  const getNoteById = useAtomCallback(
    React.useCallback((get, set, id: NoteId) => {
      const notes = get(notesAtom)
      return notes.get(id)
    }, []),
  )

  const deleteNote = React.useCallback(
    async (id: NoteId) => {
      // If the note has a gist ID, delete the gist
      const note = getNoteById(id)
      if (typeof note?.frontmatter.gist_id === "string" && githubUser?.token) {
        await deleteGist({
          githubToken: githubUser.token,
          gistId: note.frontmatter.gist_id,
        })
      }

      deleteNoteFile(id)
    },
    [deleteNoteFile, githubUser, getNoteById],
  )

  return deleteNote
}
