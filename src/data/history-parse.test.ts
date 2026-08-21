import { describe, expect, it } from "vitest"
import { extractAddedLines, filesToChangedNotes } from "./history-parse"

describe("extractAddedLines", () => {
  it("returns added lines with the leading + stripped", () => {
    const patch = [
      "@@ -1,2 +1,3 @@",
      " context line",
      "-removed line",
      "+added one",
      "+added two",
    ].join("\n")
    expect(extractAddedLines(patch)).toBe("added one\nadded two")
  })

  it("ignores the +++ file header", () => {
    const patch = ["+++ b/note.md", "@@ -0,0 +1 @@", "+real content"].join("\n")
    expect(extractAddedLines(patch)).toBe("real content")
  })

  it("returns empty string when there is no patch", () => {
    expect(extractAddedLines(undefined)).toBe("")
    expect(extractAddedLines("")).toBe("")
  })
})

describe("filesToChangedNotes", () => {
  it("maps .md files to notes and strips the extension", () => {
    const notes = filesToChangedNotes([
      { filename: "work/projects.md", status: "modified", patch: "@@ @@\n+hello" },
    ])
    expect(notes).toEqual([
      {
        noteId: "work/projects",
        status: "modified",
        addedText: "hello",
        patch: "@@ @@\n+hello",
      },
    ])
  })

  it("drops non-note files (e.g. the view-state sidecar)", () => {
    const notes = filesToChangedNotes([
      { filename: ".ruminate/view-state.json", status: "modified", patch: "+{}" },
      { filename: "2026-08-15.md", status: "added", patch: "+journal" },
      { filename: "assets/pic.png", status: "added" },
    ])
    expect(notes.map((n) => n.noteId)).toEqual(["2026-08-15"])
  })

  it("handles removals/renames with no patch as empty addedText", () => {
    const notes = filesToChangedNotes([{ filename: "old.md", status: "removed" }])
    expect(notes[0].addedText).toBe("")
  })
})
