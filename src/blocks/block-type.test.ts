import { describe, expect, it } from "vitest"
import { getBlockType, stripMarker, toggleTodo } from "./block-type"

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

  it("treats plain text as a paragraph", () => {
    expect(getBlockType("just text")).toEqual({ kind: "paragraph" })
    // A hash without a trailing space is not a heading.
    expect(getBlockType("#tag")).toEqual({ kind: "paragraph" })
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
  })

  it("leaves paragraphs untouched", () => {
    expect(stripMarker("just text")).toBe("just text")
    expect(stripMarker("#tag")).toBe("#tag")
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
