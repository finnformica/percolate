import { createFileRoute, Link } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { useAtomValue } from "jotai"
import { selectAtom } from "jotai/utils"
import { Fragment, useCallback, useEffect, useState } from "react"
import { parse } from "../blocks/parse"
import { serialize } from "../blocks/serialize"
import { emptyBlock } from "../blocks/ops"
import type { BlockDoc } from "../blocks/types"
import { BlockEditor } from "../components/block-editor/block-editor"
import { Button } from "../components/button"
import { PageLayout } from "../components/page-layout"
import { PropertyValue } from "../components/property-value"
import { globalStateMachineAtom } from "../global-state"
import { useNoteById, useSaveNote } from "../hooks/note"
import type { Note } from "../schema"
import { getVisibleFrontmatter } from "../utils/frontmatter"

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

/**
 * Frontmatter as page metadata, not editable outline content. The values come
 * from the note already parsed by `parseNote` (yamljs), so the block editor
 * never has to interpret YAML — it only round-trips the body. Reserved keys
 * (`updated_at`, `pinned`, …) are filtered out; `updated_at` is surfaced
 * separately as a relative timestamp.
 */
function NoteMetadata({ note }: { note: Note }) {
  const properties = Object.entries(getVisibleFrontmatter(note.frontmatter))
  const hasMetadata = note.updatedAt !== null || properties.length > 0
  if (!hasMetadata) return null

  return (
    <div className="mb-4 flex flex-col gap-2 border-b border-border-secondary pb-4 text-sm">
      {note.updatedAt !== null ? (
        <div className="text-text-secondary">
          Updated {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
        </div>
      ) : null}
      {properties.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
          {properties.map(([key, value]) => (
            <Fragment key={key}>
              <dt className="text-text-secondary">{key}</dt>
              <dd className="min-w-0 text-text">
                <PropertyValue property={[key, value]} />
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

function RouteComponent() {
  const { _splat: noteId } = Route.useParams()
  const { content: seedContent } = Route.useSearch()
  const note = useNoteById(noteId)
  const isRepoCloned = useAtomValue(isRepoClonedAtom)
  const saveNote = useSaveNote()

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

  return (
    <PageLayout
      title={note?.title || noteId || "Block editor"}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            {status === "saving"
              ? "Saving…"
              : status === "dirty"
                ? "Unsaved changes"
                : status === "saved"
                  ? "Saved"
                  : null}
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
        </div>
      }
    >
      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center gap-3 text-sm text-text-secondary">
          <Link
            to="/notes/$"
            params={{ _splat: noteId ?? "" }}
            search={{ mode: "read", query: undefined, classic: true }}
            className="link"
          >
            Open in classic editor
          </Link>
          <span className="text-text-tertiary">·</span>
          <span>Block editor (experimental)</span>
        </div>

        {note ? <NoteMetadata note={note} /> : null}

        {doc === null ? (
          <p className="text-text-secondary">Loading…</p>
        ) : (
          <BlockEditor doc={doc} onChange={handleChange} />
        )}
      </div>
    </PageLayout>
  )
}
