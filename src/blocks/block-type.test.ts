import { describe, expect, it } from "vitest"
import { getBlockType, leadingMarker, stripMarker, toggleTodo } from "./block-type"

describe("getBlockType", () => {
  it("detects headings by level", () => {
    expect(getBlockType("# Title")).toEqual({ kind: "heading", level: 1 })
    expect(getBlockType("### Small")).toEqual({ kind: "heading", level: 3 })
  })

  it("detects todos and their checked state", () => {
    expect(getBlockType("[ ] task")).toEqual({ kind: "todo", checked: false })
    expect(getBlockType("[x] done")).toEqual({ kind: "todo", checked: true })
    expect(getBlockType("[X] done")).toEqual({ kind: "todo", checked: true })
    // Shorthand empty brackets.
    expect(getBlockType("[] task")).toEqual({ kind: "todo", checked: false })
  })

  it("detects quotes and bullets", () => {
    expect(getBlockType("> quote")).toEqual({ kind: "quote" })
    expect(getBlockType("- item")).toEqual({ kind: "bullet" })
    expect(getBlockType("* item")).toEqual({ kind: "bullet" })
  })

  it("detects ordered-list items and their number", () => {
    expect(getBlockType("1. first")).toEqual({ kind: "ordered", number: 1 })
    expect(getBlockType("2) second")).toEqual({ kind: "ordered", number: 2 })
    expect(getBlockType("10. tenth")).toEqual({ kind: "ordered", number: 10 })
  })

  it("treats plain text as a paragraph", () => {
    expect(getBlockType("just text")).toEqual({ kind: "paragraph" })
    // A hash without a trailing space is not a heading.
    expect(getBlockType("#tag")).toEqual({ kind: "paragraph" })
    // A number without the `. `/`) ` marker is not an ordered item.
    expect(getBlockType("1st place")).toEqual({ kind: "paragraph" })
    expect(getBlockType("")).toEqual({ kind: "paragraph" })
  })
})

describe("stripMarker", () => {
  it("removes the leading marker for each type", () => {
    expect(stripMarker("# Title")).toBe("Title")
    expect(stripMarker("[ ] task")).toBe("task")
    expect(stripMarker("[x] done")).toBe("done")
    expect(stripMarker("> quote")).toBe("quote")
    expect(stripMarker("- item")).toBe("item")
    expect(stripMarker("1. first")).toBe("first")
    expect(stripMarker("2) second")).toBe("second")
  })

  it("leaves paragraphs untouched", () => {
    expect(stripMarker("just text")).toBe("just text")
    expect(stripMarker("#tag")).toBe("#tag")
  })
})

describe("leadingMarker", () => {
  it("returns the marker when the text starts with one", () => {
    expect(leadingMarker("# Title")).toBe("# ")
    expect(leadingMarker("### Small")).toBe("### ")
    expect(leadingMarker("- item")).toBe("- ")
    expect(leadingMarker("[] task")).toBe("[] ")
    expect(leadingMarker("[x] done")).toBe("[x] ")
    expect(leadingMarker("> quote")).toBe("> ")
    expect(leadingMarker("1. first")).toBe("1. ")
  })

  it("returns null without a trailing space, so a partial marker never switches type", () => {
    expect(leadingMarker("#tag")).toBeNull()
    expect(leadingMarker("-dash")).toBeNull()
    expect(leadingMarker("1st")).toBeNull()
    expect(leadingMarker("plain text")).toBeNull()
    expect(leadingMarker("")).toBeNull()
  })
})

describe("toggleTodo", () => {
  it("flips checked state, preserving the rest", () => {
    expect(toggleTodo("[ ] task")).toBe("[x] task")
    expect(toggleTodo("[x] task")).toBe("[ ] task")
    expect(toggleTodo("[] task")).toBe("[x] task")
  })

  it("is a no-op for non-todos", () => {
    expect(toggleTodo("# heading")).toBe("# heading")
    expect(toggleTodo("plain")).toBe("plain")
  })
})
