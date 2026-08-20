import { useMatch, useNavigate } from "@tanstack/react-router"
import { parseDate } from "chrono-node"
import { Command } from "cmdk"
import copy from "copy-to-clipboard"
import { atom, useAtom, useAtomValue } from "jotai"
import { selectAtom, useAtomCallback } from "jotai/utils"
import { useCallback, useMemo, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDebounce } from "use-debounce"
import { githubRepoAtom, notesAtom, pinnedNotesAtom, tagSearcherAtom } from "../global-state"
import { useNoteById, useSaveNote } from "../hooks/note"
import { useSearchNotes } from "../hooks/search-notes"
import { Note } from "../schema"
import { formatDate, formatDateDistance, toDateString } from "../utils/date"
import { getHeadings } from "../utils/headings"
import { generateNoteId, toNoteId } from "../utils/note-id"
import { pluralize } from "../utils/pluralize"
import {
  CalendarDateIcon16,
  CopyIcon16,
  ExternalLinkIcon16,
  GlobeIcon16,
  NoteIcon16,
  PinFillIcon12,
  PlusIcon16,
  PrinterIcon16,
  SearchIcon16,
  SettingsIcon16,
  TagIcon16,
} from "./icons"
import { NoteFavicon } from "./note-favicon"

export const isCommandMenuOpenAtom = atom(false)

const hasDailyNoteAtom = selectAtom(notesAtom, (notes) => notes.has(toDateString(new Date())))

export function CommandMenu() {
  const navigate = useNavigate()
  const githubRepo = useAtomValue(githubRepoAtom)
  const searchNotes = useSearchNotes()
  const tagSearcher = useAtomValue(tagSearcherAtom)
  const saveNote = useSaveNote()
  const notes = useAtomValue(notesAtom)
  const pinnedNotes = useAtomValue(pinnedNotesAtom)
  const getHasDailyNote = useAtomCallback(useCallback((get) => get(hasDailyNoteAtom), []))
  const [isOpen, setIsOpen] = useAtom(isCommandMenuOpenAtom)

  // Get the current note if we're on a note page.
  // This is used to show note actions in the command menu.
  const noteMatch = useMatch({ from: "/_appRoot/notes_/$", shouldThrow: false })
  const noteId = noteMatch?.params._splat
  const note = useNoteById(noteId)

  // Refs
  const prevActiveElement = useRef<HTMLElement>()

  // Local state
  const [query, setQuery] = useState("")
  const [deferredQuery] = useDebounce(query, 150)

  const openMenu = useCallback(() => {
    prevActiveElement.current = document.activeElement as HTMLElement
    setIsOpen(true)
  }, [setIsOpen])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setTimeout(() => {
      prevActiveElement.current?.focus()
    })
  }, [setIsOpen])

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu()
    } else {
      openMenu()
    }
  }, [isOpen, openMenu, closeMenu])

  const handleSelect = useCallback(
    (callback: () => void) => {
      return () => {
        setIsOpen(false)
        setQuery("")
        callback()
      }
    },
    [setIsOpen],
  )

  // Open a note, optionally highlighting one of its headings on landing.
  const openNote = useCallback(
    (id: string, heading?: string) => {
      setIsOpen(false)
      setQuery("")
      navigate({
        to: "/notes/$",
        params: { _splat: id },
        search: { mode: "read", query: undefined, heading },
      })
    },
    [setIsOpen, navigate],
  )

  useHotkeys("mod+k", toggleMenu, {
    preventDefault: true,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  })

  const navItems = useMemo(() => {
    return [
      {
        label: "Notes",
        icon: <NoteIcon16 />,
        onSelect: () => {
          navigate({
            to: "/",
            search: {
              query: undefined,
            },
          })
        },
      },
      {
        label: "Calendar",
        icon: <CalendarDateIcon16 date={new Date().getDate()} />,
        onSelect: () => {
          navigate({
            to: "/notes/$",
            params: {
              _splat: toDateString(new Date()),
            },
            search: {
              mode: getHasDailyNote() ? "read" : "write",
              query: undefined,
            },
          })
        },
      },
      {
        label: "Tags",
        icon: <TagIcon16 />,
        onSelect: () => {
          navigate({
            to: "/tags",
            search: {
              query: undefined,
              sort: "name",
            },
          })
        },
      },
      {
        label: "Settings",
        icon: <SettingsIcon16 />,
        onSelect: () => {
          navigate({
            to: "/settings",
          })
        },
      },
    ]
  }, [navigate, getHasDailyNote])

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      return item.label.toLowerCase().includes(deferredQuery.toLowerCase())
    })
  }, [navItems, deferredQuery])

  const noteActions = useMemo(() => {
    if (!note) return []
    return [
      // TODO: Get the codemirror instance and update the editor value when pinning/unpinning
      // {
      //   label: note.pinned ? "Unpin note" : "Pin note",
      //   icon: note.pinned ? <PinFillIcon16 className="text-text-pinned" /> : <PinIcon16 />,
      //   onSelect: () => {
      //     saveNote({
      //       id: note.id,
      //       content: updateFrontmatter({
      //         content: note.content,
      //         properties: { pinned: note.pinned ? null : true },
      //       }),
      //     })
      //   },
      // },
      {
        label: "Copy note markdown",
        icon: <CopyIcon16 />,
        onSelect: () => {
          copy(note.content)
        },
      },
      {
        label: "Copy note ID",
        icon: <CopyIcon16 />,
        onSelect: () => {
          copy(note.id)
        },
      },
      {
        label: "Open in GitHub",
        icon: <ExternalLinkIcon16 />,
        onSelect: () => {
          if (!githubRepo) return
          const url = `https://github.com/${githubRepo.owner}/${githubRepo.name}/blob/main/${note.id}.md`
          window.open(url, "_blank")
        },
      },
      {
        label: "Print note",
        icon: <PrinterIcon16 />,
        onSelect: () => {
          window.print()
        },
      },
    ]
  }, [note, githubRepo])

  const filteredNoteActions = useMemo(() => {
    return noteActions.filter((item) => {
      return item.label.toLowerCase().includes(deferredQuery.toLowerCase())
    })
  }, [noteActions, deferredQuery])

  // Check if query can be parsed as a date
  const dateString = useMemo(() => {
    const date = parseDate(deferredQuery)
    if (!date) return ""
    return toDateString(date)
  }, [deferredQuery])

  // Search tags
  const tagResults = useMemo(() => {
    return tagSearcher.search(deferredQuery)
  }, [tagSearcher, deferredQuery])

  // Search notes
  const noteResults = useMemo(() => {
    return searchNotes(deferredQuery)
  }, [searchNotes, deferredQuery])

  // Only show the first 2 tags
  const numVisibleTags = 2

  // Only show the first 6 notes
  const numVisibleNotes = 6

  return (
    <Command.Dialog
      label="Global command menu"
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          openMenu()
        } else {
          closeMenu()
        }
      }}
      shouldFilter={false}
      onKeyDown={(event) => {
        // Clear input with `esc`
        if (event.key === "Escape" && query) {
          setQuery("")
          event.preventDefault()
        }
      }}
    >
      <div className="card-3 overflow-hidden rounded-xl!">
        <Command.Input
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
          autoCapitalize="off"
        />

        <Command.List>
          {filteredNoteActions.length > 0 ? (
            <Command.Group heading="Note actions">
              {filteredNoteActions.map((action) => (
                <CommandItem
                  key={action.label}
                  icon={action.icon}
                  onSelect={handleSelect(action.onSelect)}
                >
                  {action.label}
                </CommandItem>
              ))}
            </Command.Group>
          ) : null}
          {filteredNavItems.length ? (
            <Command.Group heading="Jump to">
              {filteredNavItems.map((item) => (
                <CommandItem
                  key={item.label}
                  icon={item.icon}
                  onSelect={handleSelect(item.onSelect)}
                >
                  {item.label}
                </CommandItem>
              ))}
            </Command.Group>
          ) : null}
          {!deferredQuery && pinnedNotes.length ? (
            <Command.Group heading="Pinned notes">
              {pinnedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  // Since they're all pinned, we don't need to show the pin icon
                  hidePinIcon
                  onOpen={(heading) => openNote(note.id, heading)}
                />
              ))}
            </Command.Group>
          ) : null}
          {dateString ? (
            <Command.Group heading="Date">
              <CommandItem
                key={dateString}
                icon={<CalendarDateIcon16 date={new Date(dateString).getUTCDate()} />}
                description={formatDateDistance(dateString)}
                onSelect={handleSelect(() => {
                  navigate({
                    to: "/notes/$",
                    params: {
                      _splat: dateString,
                    },
                    search: {
                      mode: "read",
                      query: undefined,
                    },
                  })
                })}
              >
                {formatDate(dateString)}
              </CommandItem>
            </Command.Group>
          ) : null}
          {tagResults.length ? (
            <Command.Group heading="Tags">
              {tagResults.slice(0, numVisibleTags).map(([name, noteIds]) => (
                <CommandItem
                  key={name}
                  icon={<TagIcon16 />}
                  description={pluralize(noteIds.length, "note")}
                  onSelect={handleSelect(() =>
                    navigate({
                      to: "/",
                      search: { query: `tag:${name}` },
                    }),
                  )}
                >
                  {name}
                </CommandItem>
              ))}
              {tagResults.length > numVisibleTags ? (
                <CommandItem
                  key={`Show all tags matching "${deferredQuery}"`}
                  icon={<SearchIcon16 />}
                  onSelect={handleSelect(() =>
                    navigate({
                      to: "/tags",
                      search: {
                        query: deferredQuery,
                        sort: "name",
                      },
                    }),
                  )}
                >
                  Show all {pluralize(tagResults.length, "tag")} matching "{deferredQuery}"
                </CommandItem>
              ) : null}
            </Command.Group>
          ) : null}
          {deferredQuery ? (
            <Command.Group heading="Notes">
              {noteResults.slice(0, numVisibleNotes).map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onOpen={(heading) => openNote(note.id, heading)}
                />
              ))}
              {noteResults.length > 0 ? (
                <CommandItem
                  key={`Show all notes matching "${deferredQuery}"`}
                  icon={<SearchIcon16 />}
                  onSelect={handleSelect(() =>
                    navigate({
                      to: "/",
                      search: {
                        query: deferredQuery,
                      },
                    }),
                  )}
                >
                  Show all {pluralize(noteResults.length, "note")} matching "{deferredQuery}"
                </CommandItem>
              ) : null}
              <CommandItem
                key={`Create new note "${deferredQuery}"`}
                icon={<PlusIcon16 />}
                onSelect={handleSelect(() => {
                  // The typed text becomes the note's name (its filename), not
                  // the first line of content. Fall back to a generated id if
                  // the text has no filename-safe characters.
                  const id = toNoteId(deferredQuery) || generateNoteId()

                  // If a note with that name already exists, open it rather
                  // than overwriting it with an empty note.
                  if (!notes.has(id)) {
                    saveNote({ id, content: "" })
                  }

                  navigate({
                    to: "/notes/$",
                    params: {
                      _splat: id,
                    },
                    search: {
                      mode: "write",
                      query: undefined,
                    },
                  })
                })}
              >
                Create new note "{deferredQuery}"
              </CommandItem>
            </Command.Group>
          ) : null}
        </Command.List>
      </div>
    </Command.Dialog>
  )
}

type CommandItemProps = {
  children: React.ReactNode
  value?: string
  icon?: React.ReactNode
  description?: string
  className?: string
  onSelect?: () => void
}

function CommandItem({
  children,
  value,
  icon,
  description,
  className,
  onSelect,
}: CommandItemProps) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={className}>
      <div className="flex items-center gap-3">
        <div className="grid h-4 w-4 place-items-center text-text-secondary">{icon}</div>
        <div className="grow truncate">{children}</div>
        {description ? <span className="shrink-0 text-text-secondary">{description}</span> : null}
        <span className="hidden leading-none text-text-secondary in-aria-selected:inline epaper:in-aria-selected:text-bg">
          ⏎
        </span>
      </div>
    </Command.Item>
  )
}

// How many of a note's headings to list beneath it.
const NUM_VISIBLE_HEADINGS = 4

function NoteItem({
  note,
  hidePinIcon,
  onOpen,
}: {
  note: Note
  hidePinIcon?: boolean
  onOpen: (heading?: string) => void
}) {
  // Show the note by its filename, with its headings listed (tabbed over) as
  // children so you can find a note by a heading it contains. Selecting the
  // note opens it; selecting a heading opens it and highlights that heading.
  const headings = getHeadings(note.content).slice(0, NUM_VISIBLE_HEADINGS)
  return (
    <>
      <CommandItem value={note.id} icon={<NoteFavicon note={note} />} onSelect={() => onOpen()}>
        <span className="flex items-center gap-2 truncate">
          {!hidePinIcon && note.pinned ? (
            <PinFillIcon12 className="shrink-0 text-text-pinned" />
          ) : null}
          {note?.frontmatter?.gist_id ? (
            <GlobeIcon16 className="shrink-0 text-border-focus" />
          ) : null}
          <span className="truncate">{note.id}</span>
        </span>
      </CommandItem>
      {headings.map((heading, index) => (
        <CommandItem
          key={`${note.id}::${index}`}
          value={`${note.id} › ${heading.text}`}
          className="pl-9!"
          icon={<span className="text-text-tertiary">#</span>}
          onSelect={() => onOpen(heading.text)}
        >
          <span className="truncate text-text-secondary">{heading.text}</span>
        </CommandItem>
      ))}
    </>
  )
}
