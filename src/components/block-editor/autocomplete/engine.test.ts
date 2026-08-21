import { describe, expect, it } from "vitest"
import { queryCompletions } from "./engine"
import type { CompletionOption, CompletionSource } from "./types"

const option = (id: string): CompletionOption => ({
  id,
  label: id,
  apply: (range) => ({ from: range.from, to: range.to, insert: id, caret: range.from + id.length }),
})

const source =
  (from: number, to: number, ...ids: string[]): CompletionSource =>
  () => ({ from, to, options: ids.map(option) })

describe("queryCompletions", () => {
  it("returns null when no source matches", () => {
    const none: CompletionSource = () => null
    expect(queryCompletions("x", 1, [none])).toBeNull()
  })

  it("ignores sources that match but offer no options", () => {
    const empty: CompletionSource = () => ({ from: 0, to: 1, options: [] })
    expect(queryCompletions("x", 1, [empty])).toBeNull()
  })

  it("merges peer sources sharing an anchor", () => {
    const result = queryCompletions("[[m", 3, [
      source(0, 3, "date"),
      source(0, 3, "note-a", "note-b"),
    ])
    expect(result).not.toBeNull()
    expect(result!.from).toBe(0)
    expect(result!.options.map((o) => o.id)).toEqual(["date", "note-a", "note-b"])
  })

  it("prefers the trigger nearest the caret when anchors differ", () => {
    // A stray earlier "[[" and a later "#tag" — the #tag (larger from) wins.
    const result = queryCompletions("[[x #t", 6, [source(0, 2, "wikilink"), source(4, 6, "tag")])
    expect(result!.from).toBe(4)
    expect(result!.options.map((o) => o.id)).toEqual(["tag"])
  })
})
