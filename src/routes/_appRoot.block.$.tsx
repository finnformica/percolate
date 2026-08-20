import { createFileRoute, Link } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { Fragment, useEffect, useState } from "react"
import { useDebouncedCallback } from "use-debounce"
import { parse } from "../blocks/parse"
import { serialize } from "../blocks/serialize"
import { emptyBlock } from "../blocks/ops"
import type { BlockDoc } from "../blocks/types"
import { BlockEditor } from "../components/block-editor/block-editor"
import { PageLayout } from "../components/page-layout"
import { PropertyValue } from "../components/property-value"
import { useNoteById, useSaveNote } from "../hooks/note"
import type { Note } from "../schema"
import { getVisibleFrontmatter } from "../utils/frontmatter"

export const Route = createFileRoute("/_appRoot/block/$")({
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
  const note = useNoteById(noteId)
  const saveNote = useSaveNote()

  const [doc, setDoc] = useState<BlockDoc | null>(null)
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")

  // Parse the note's markdown into blocks once, when it first loads.
  useEffect(() => {
    if (note && doc === null) setDoc(withStarterBlock(parse(note.content)))
  }, [note, doc])

  // Serialize back to markdown and save through the existing GitHub sync
  // (writes the file, commits, and pushes — debounced in the state machine).
  const save = useDebouncedCallback((next: BlockDoc) => {
    if (!noteId) return
    void Promise.resolve(saveNote({ id: noteId, content: serialize(next) })).then(() =>
      setStatus("saved"),
    )
  }, 800)

  const handleChange = (next: BlockDoc) => {
    setDoc(next)
    setStatus("saving")
    save(next)
  }

  return (
    <PageLayout
      title={note?.title || noteId || "Block editor"}
      actions={
        <span className="text-sm text-text-secondary">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : null}
        </span>
      }
    >
      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center gap-3 text-sm text-text-secondary">
          <Link
            to="/notes/$"
            params={{ _splat: noteId ?? "" }}
            search={{ mode: "read", query: undefined, view: "grid" }}
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
