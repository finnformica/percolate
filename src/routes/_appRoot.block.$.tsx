import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { useAtomValue } from "jotai"
import { selectAtom } from "jotai/utils"
import copy from "copy-to-clipboard"
import { useCallback, useEffect, useState } from "react"
import { parse } from "../blocks/parse"
import { serialize } from "../blocks/serialize"
import { emptyBlock } from "../blocks/ops"
import type { BlockDoc } from "../blocks/types"
import { BlockEditor } from "../components/block-editor/block-editor"
import { Button } from "../components/button"
import { DropdownMenu } from "../components/dropdown-menu"
import { IconButton } from "../components/icon-button"
import {
  CopyIcon16,
  EditIcon16,
  ExternalLinkIcon16,
  MoreIcon16,
  NoteIcon16,
  PrinterIcon16,
  TrashIcon16,
} from "../components/icons"
import { PageLayout } from "../components/page-layout"
import { githubRepoAtom, globalStateMachineAtom } from "../global-state"
import { useDeleteNote, useNoteById, useRenameNote, useSaveNote } from "../hooks/note"
import { getInvalidNoteIdCharacters } from "../utils/note-id"
import { pluralize } from "../utils/pluralize"

type RouteSearch = {
  /** Initial content for a not-yet-created note (e.g. seeded frontmatter). */
  content?: string
}

const isRepoClonedAtom = selectAtom(globalStateMachineAtom, (state) =>
  state.matches("signedIn.cloned"),
)

export const Route = createFileRoute("/_appRoot/block/$")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => ({
    content: typeof search.content === "string" ? search.content : undefined,
  }),
  component: RouteComponent,
})

/** Ensure a parsed doc always has at least one block to edit. */
function withStarterBlock(doc: BlockDoc): BlockDoc {
  if (doc.rootBlockIds.length > 0) return doc
  const block = emptyBlock()
  return { ...doc, rootBlockIds: [block.id], blocks: { [block.id]: block } }
}

function RouteComponent() {
  const { _splat: noteId } = Route.useParams()
  const { content: seedContent } = Route.useSearch()
  const note = useNoteById(noteId)
  const isRepoCloned = useAtomValue(isRepoClonedAtom)
  const githubRepo = useAtomValue(githubRepoAtom)
  const saveNote = useSaveNote()
  const renameNote = useRenameNote()
  const deleteNote = useDeleteNote()
  const navigate = useNavigate()

  const [doc, setDoc] = useState<BlockDoc | null>(null)
  const [status, setStatus] = useState<"clean" | "dirty" | "saving" | "saved">("clean")

  // Parse the note into blocks once the repo has loaded. An existing note uses
  // its own content; a not-yet-created note starts from the seed content (e.g.
  // frontmatter for a brand-new note) or empty. Gating on the cloned repo means
  // an undefined note is genuinely new, not merely still loading.
  useEffect(() => {
    if (doc !== null || !isRepoCloned) return
    setDoc(withStarterBlock(parse(note?.content ?? seedContent ?? "")))
  }, [isRepoCloned, note, doc, seedContent])

  // Edits update the in-memory doc and mark it dirty — saving is explicit.
  const handleChange = (next: BlockDoc) => {
    setDoc(next)
    setStatus("dirty")
  }

  // Serialize back to markdown and save through the existing GitHub sync
  // (writes the file, commits, and pushes via the state machine).
  const handleSave = useCallback(async () => {
    if (!noteId || doc === null) return
    setStatus("saving")
    await Promise.resolve(saveNote({ id: noteId, content: serialize(doc) }))
    setStatus("saved")
  }, [noteId, doc, saveNote])

  // ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSave])

  const handleRename = useCallback(() => {
    if (!noteId || doc === null) return
    const raw = window.prompt("Rename file", noteId)
    if (!raw) return
    const newNoteId = raw.trim().replace(/\.md$/i, "").trim()
    if (!newNoteId || newNoteId === noteId) return

    const result = renameNote({ oldName: noteId, newName: newNoteId, content: serialize(doc) })
    if (!result.success) {
      if (result.reason === "invalid") {
        const chars = Array.from(new Set(getInvalidNoteIdCharacters(newNoteId)))
          .map((c) => `"${c}"`)
          .join(", ")
        window.alert(`"${newNoteId}.md" contains invalid characters${chars ? `: ${chars}` : ""}`)
      } else if (result.reason === "duplicate") {
        window.alert(`"${newNoteId}.md" already exists.`)
      }
      return
    }
    navigate({ to: "/block/$", params: { _splat: newNoteId }, search: {}, replace: true })
  }, [noteId, doc, renameNote, navigate])

  const handleDelete = useCallback(() => {
    if (!noteId || !note) return
    if (
      note.backlinks.length > 0 &&
      !window.confirm(
        `${note.id}.md has ${pluralize(note.backlinks.length, "backlink")}. Are you sure you want to delete it?`,
      )
    ) {
      return
    }
    deleteNote(note.id)
    navigate({ to: "/", search: { query: undefined } })
  }, [noteId, note, deleteNote, navigate])

  const updatedLabel =
    note?.updatedAt != null
      ? `Updated ${formatDistanceToNow(note.updatedAt, { addSuffix: true })}`
      : null

  return (
    <PageLayout
      title={`${noteId || "Untitled"}.md`}
      icon={<NoteIcon16 />}
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-text-secondary sm:inline">
            {status === "dirty"
              ? "Unsaved changes"
              : status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved"
                  : updatedLabel}
          </span>
          <Button
            variant="primary"
            size="small"
            shortcut={["⌘", "S"]}
            disabled={status !== "dirty"}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenu.Trigger
              render={
                <IconButton aria-label="More actions" size="small" disableTooltip>
                  <MoreIcon16 />
                </IconButton>
              }
            />
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                icon={<CopyIcon16 />}
                onClick={() => copy(doc ? serialize(doc) : "")}
              >
                Copy markdown
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<CopyIcon16 />} onClick={() => copy(noteId ?? "")}>
                Copy ID
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<EditIcon16 />} onClick={handleRename}>
                Rename file
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                icon={<ExternalLinkIcon16 />}
                href={`https://github.com/${githubRepo?.owner}/${githubRepo?.name}/blob/main/${noteId}.md`}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!note}
              >
                Open in GitHub
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<NoteIcon16 />}
                onClick={() =>
                  navigate({
                    to: "/notes/$",
                    params: { _splat: noteId ?? "" },
                    search: { mode: "read", query: undefined, classic: true },
                  })
                }
              >
                Open in classic editor
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<PrinterIcon16 />} onClick={() => window.print()}>
                Print
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                variant="danger"
                icon={<TrashIcon16 />}
                disabled={!note}
                onClick={handleDelete}
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl p-4">
        {doc === null ? (
          <p className="text-text-secondary">Loading…</p>
        ) : (
          <BlockEditor doc={doc} onChange={handleChange} />
        )}
      </div>
    </PageLayout>
  )
}
