import { useLocation, useNavigate } from "@tanstack/react-router"
import copy from "copy-to-clipboard"
import { useAtomValue } from "jotai"
import { githubRepoAtom, isSignedOutAtom } from "../global-state"
import { useDeleteNote, useRenameNote, useSaveNote } from "../hooks/note"
import type { Note } from "../schema"
import { cx } from "../utils/cx"
import { updateFrontmatterValue } from "../utils/frontmatter"
import { clearNoteDraft } from "../utils/note-draft"
import { getInvalidNoteIdCharacters } from "../utils/note-id"
import { pluralize } from "../utils/pluralize"
import { DropdownMenu } from "./dropdown-menu"
import { IconButton } from "./icon-button"
import {
  CopyIcon16,
  EditIcon16,
  ExternalLinkIcon16,
  MoreIcon16,
  PinFillIcon16,
  PinIcon16,
  TrashIcon16,
} from "./icons"

/**
 * The per-note actions menu (pin, copy, rename, delete, open in GitHub) — the
 * same set the open note offers in its header, extracted so it can be triggered
 * from the sidebar too. Operates on `note` directly rather than the open editor,
 * so it works for any note without leaving the one you're on.
 */
export function NoteActionsMenu({ note, className }: { note: Note; className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const githubRepo = useAtomValue(githubRepoAtom)
  const isSignedOut = useAtomValue(isSignedOutAtom)
  const saveNote = useSaveNote()
  const renameNote = useRenameNote()
  const deleteNote = useDeleteNote()

  const isViewing = location.pathname === `/notes/${note.id}`

  const togglePin = () => {
    saveNote({
      id: note.id,
      content: updateFrontmatterValue({
        content: note.content,
        properties: { pinned: note.pinned ? null : true },
      }),
    })
  }

  const rename = () => {
    const raw = window.prompt("Rename file", note.id)
    if (raw == null) return
    const newNoteId = raw.trim().replace(/\.md$/i, "").trim()
    if (!newNoteId || newNoteId === note.id) return

    const result = renameNote({ oldName: note.id, newName: newNoteId, content: note.content })
    if (!result.success) {
      if (result.reason === "invalid") {
        const invalid = Array.from(new Set(getInvalidNoteIdCharacters(newNoteId)))
          .map((char) => `"${char}"`)
          .join(", ")
        window.alert(
          `"${newNoteId}.md" contains invalid characters${invalid ? `: ${invalid}` : ""}`,
        )
      } else if (result.reason === "duplicate") {
        window.alert(`"${newNoteId}.md" already exists.`)
      }
      return
    }

    clearNoteDraft({ githubRepo, noteId: note.id })
    clearNoteDraft({ githubRepo, noteId: newNoteId })
    if (isViewing) {
      navigate({
        to: "/notes/$",
        params: { _splat: newNoteId },
        search: { query: undefined },
        replace: true,
      })
    }
  }

  const remove = () => {
    if (
      note.backlinks.length > 0 &&
      !window.confirm(
        `${note.id}.md has ${pluralize(note.backlinks.length, "backlink")}. Are you sure you want to delete it?`,
      )
    ) {
      return
    }
    clearNoteDraft({ githubRepo, noteId: note.id })
    deleteNote(note.id)
    if (isViewing) {
      navigate({ to: "/", search: { query: undefined }, replace: true })
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenu.Trigger
        render={
          <IconButton
            aria-label="Note actions"
            size="small"
            disableTooltip
            className={cx("shrink-0", className)}
          >
            <MoreIcon16 />
          </IconButton>
        }
      />
      <DropdownMenu.Content align="start">
        <DropdownMenu.Item
          icon={note.pinned ? <PinFillIcon16 className="text-text-pinned" /> : <PinIcon16 />}
          onClick={togglePin}
        >
          {note.pinned ? "Unpin" : "Pin"}
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<CopyIcon16 />} onClick={() => copy(note.content)}>
          Copy markdown
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<CopyIcon16 />} onClick={() => copy(note.id)}>
          Copy ID
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<EditIcon16 />} disabled={isSignedOut} onClick={rename}>
          Rename file
        </DropdownMenu.Item>
        <DropdownMenu.Item
          icon={<ExternalLinkIcon16 />}
          href={`https://github.com/${githubRepo?.owner}/${githubRepo?.name}/blob/main/${note.id}.md`}
          target="_blank"
          rel="noopener noreferrer"
          disabled={isSignedOut}
        >
          Open in GitHub
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant="danger"
          icon={<TrashIcon16 />}
          disabled={isSignedOut}
          onClick={remove}
        >
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
