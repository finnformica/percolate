import { describe, expect, it } from "vitest"
import { parseViewState } from "./view-state-parse"

describe("parseViewState", () => {
  it("returns empty for missing content", () => {
    expect(parseViewState(undefined)).toEqual({})
    expect(parseViewState("")).toEqual({})
  })

  it("parses a well-formed sidecar", () => {
    const raw = JSON.stringify({ "work/projects": ["blk_a", "blk_b"], personal: ["blk_c"] })
    expect(parseViewState(raw)).toEqual({
      "work/projects": ["blk_a", "blk_b"],
      personal: ["blk_c"],
    })
  })

  it("degrades to empty on malformed JSON", () => {
    expect(parseViewState("{ not json")).toEqual({})
  })

  it("ignores non-object and array top levels", () => {
    expect(parseViewState("42")).toEqual({})
    expect(parseViewState("null")).toEqual({})
    expect(parseViewState(JSON.stringify(["a", "b"]))).toEqual({})
  })

  it("drops entries whose value is not a string array and non-string ids", () => {
    const raw = JSON.stringify({ a: "not-an-array", b: 3, c: ["blk_x", 5, null, "blk_y"] })
    expect(parseViewState(raw)).toEqual({ c: ["blk_x", "blk_y"] })
  })
})
