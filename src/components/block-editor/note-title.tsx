import { useState } from "react"

/**
 * The note's name shown as an editable `# ` heading at the top of the page —
 * outside the block flow, but editable to rename the note. Commits on Enter or
 * blur; Escape reverts. `onRename` returns whether the rename succeeded so the
 * field can revert on failure (invalid name, duplicate).
 */
export function NoteTitle({
  noteId,
  onRename,
}: {
  noteId: string
  onRename: (name: string) => boolean
}) {
  const [value, setValue] = useState(noteId)
  // Reset the field when navigating to a different note (no effect needed).
  const [prevId, setPrevId] = useState(noteId)
  if (noteId !== prevId) {
    setPrevId(noteId)
    setValue(noteId)
  }

  const commit = () => {
    const next = value.trim()
    if (!next || next === noteId) {
      setValue(noteId)
      return
    }
    if (!onRename(next)) setValue(noteId)
  }

  return (
    <h1 className="flex items-baseline gap-2 font-content text-2xl font-bold leading-tight">
      <span aria-hidden className="select-none text-text-tertiary">
        #
      </span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === "Escape") {
            setValue(noteId)
            event.currentTarget.blur()
          }
        }}
        spellCheck={false}
        aria-label="Note name"
        placeholder="Untitled"
        className="min-w-0 flex-1 border-none bg-transparent p-0 text-text outline-none placeholder:text-text-tertiary"
      />
    </h1>
  )
}
