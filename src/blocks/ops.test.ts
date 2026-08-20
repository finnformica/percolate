import { describe, expect, it } from "vitest"
import {
  emptyBlock,
  indentBlock,
  insertAfter,
  insertBefore,
  outdentBlock,
  removeBlock,
  updateContent,
} from "./ops"
import type { BlockDoc } from "./types"

/**
 * A small fixture:
 *   - a
 *   - b
 *     - b1
 *   - c
 */
function fixture(): BlockDoc {
  return {
    frontmatter: "title: t",
    rootBlockIds: ["a", "b", "c"],
    blocks: {
      a: { id: "a", content: "A", children: [] },
      b: { id: "b", content: "B", children: ["b1"] },
      b1: { id: "b1", content: "B1", children: [] },
      c: { id: "c", content: "C", children: [] },
    },
  }
}

describe("emptyBlock", () => {
  it("mints a block with a fresh id and empty content by default", () => {
    const block = emptyBlock()
    expect(block.id).toMatch(/^blk_[0-9a-z]{10}$/)
    expect(block.content).toBe("")
    expect(block.children).toEqual([])
  })

  it("accepts initial content", () => {
    expect(emptyBlock("hello").content).toBe("hello")
  })

  it("mints a distinct id each call", () => {
    expect(emptyBlock().id).not.toBe(emptyBlock().id)
  })
})

describe("updateContent", () => {
  it("updates a block's content immutably", () => {
    const doc = fixture()
    const next = updateContent(doc, "a", "A!")
    expect(next.blocks["a"].content).toBe("A!")
    // Original untouched.
    expect(doc.blocks["a"].content).toBe("A")
    expect(next).not.toBe(doc)
  })

  it("returns the same doc for an unknown id", () => {
    const doc = fixture()
    expect(updateContent(doc, "nope", "x")).toBe(doc)
  })

  it("carries frontmatter through", () => {
    expect(updateContent(fixture(), "a", "A!").frontmatter).toBe("title: t")
  })
})

describe("insertAfter", () => {
  it("inserts a sibling after a root block", () => {
    const doc = fixture()
    const fresh = { id: "x", content: "X", children: [] }
    const next = insertAfter(doc, "a", fresh)
    expect(next.rootBlockIds).toEqual(["a", "x", "b", "c"])
    expect(next.blocks["x"]).toEqual(fresh)
    // Original untouched.
    expect(doc.rootBlockIds).toEqual(["a", "b", "c"])
  })

  it("inserts a sibling after a nested block", () => {
    const doc = fixture()
    const fresh = { id: "b2", content: "B2", children: [] }
    const next = insertAfter(doc, "b1", fresh)
    expect(next.blocks["b"].children).toEqual(["b1", "b2"])
    // Original child list untouched.
    expect(doc.blocks["b"].children).toEqual(["b1"])
  })

  it("appends when inserting after the last sibling", () => {
    const next = insertAfter(fixture(), "c", { id: "x", content: "X", children: [] })
    expect(next.rootBlockIds).toEqual(["a", "b", "c", "x"])
  })

  it("returns the same doc for an unknown refId", () => {
    const doc = fixture()
    expect(insertAfter(doc, "nope", { id: "x", content: "", children: [] })).toBe(doc)
  })
})

describe("insertBefore", () => {
  it("inserts a sibling before a root block", () => {
    const doc = fixture()
    const fresh = { id: "x", content: "X", children: [] }
    const next = insertBefore(doc, "b", fresh)
    expect(next.rootBlockIds).toEqual(["a", "x", "b", "c"])
    // Original untouched.
    expect(doc.rootBlockIds).toEqual(["a", "b", "c"])
  })

  it("inserts before the first child of a parent", () => {
    const doc = fixture()
    const fresh = { id: "b0", content: "B0", children: [] }
    const next = insertBefore(doc, "b1", fresh)
    expect(next.blocks["b"].children).toEqual(["b0", "b1"])
  })

  it("prepends when inserting before the first sibling", () => {
    const next = insertBefore(fixture(), "a", { id: "x", content: "X", children: [] })
    expect(next.rootBlockIds).toEqual(["x", "a", "b", "c"])
  })

  it("returns the same doc for an unknown refId", () => {
    const doc = fixture()
    expect(insertBefore(doc, "nope", { id: "x", content: "", children: [] })).toBe(doc)
  })
})

describe("removeBlock", () => {
  it("removes a middle root and focuses the previous sibling", () => {
    const { doc, focusId } = removeBlock(fixture(), "c")
    expect(doc.rootBlockIds).toEqual(["a", "b"])
    expect(focusId).toBe("b")
  })

  it("removes a block and its whole subtree from the blocks map", () => {
    const { doc } = removeBlock(fixture(), "b")
    expect(doc.rootBlockIds).toEqual(["a", "c"])
    expect(doc.blocks["b"]).toBeUndefined()
    expect(doc.blocks["b1"]).toBeUndefined()
  })

  it("focuses the parent when removing a first child", () => {
    const { doc, focusId } = removeBlock(fixture(), "b1")
    expect(doc.blocks["b"].children).toEqual([])
    expect(focusId).toBe("b")
  })

  it("focuses null when removing the first root", () => {
    const { focusId } = removeBlock(fixture(), "a")
    expect(focusId).toBeNull()
  })

  it("leaves the original doc untouched", () => {
    const doc = fixture()
    removeBlock(doc, "b")
    expect(doc.rootBlockIds).toEqual(["a", "b", "c"])
    expect(doc.blocks["b1"]).toBeDefined()
  })

  it("returns the same doc and null focus for an unknown id", () => {
    const doc = fixture()
    const result = removeBlock(doc, "nope")
    expect(result.doc).toBe(doc)
    expect(result.focusId).toBeNull()
  })
})

describe("indentBlock", () => {
  it("makes a block the last child of its previous sibling", () => {
    const next = indentBlock(fixture(), "c")
    expect(next.rootBlockIds).toEqual(["a", "b"])
    expect(next.blocks["b"].children).toEqual(["b1", "c"])
  })

  it("carries a block's own subtree when indenting", () => {
    const next = indentBlock(fixture(), "b")
    expect(next.rootBlockIds).toEqual(["a", "c"])
    expect(next.blocks["a"].children).toEqual(["b"])
    // b keeps its child.
    expect(next.blocks["b"].children).toEqual(["b1"])
  })

  it("is a no-op for the first block in its list", () => {
    const doc = fixture()
    expect(indentBlock(doc, "a")).toBe(doc)
  })

  it("is a no-op for a first child", () => {
    const doc = fixture()
    expect(indentBlock(doc, "b1")).toBe(doc)
  })

  it("leaves the original doc untouched", () => {
    const doc = fixture()
    indentBlock(doc, "c")
    expect(doc.rootBlockIds).toEqual(["a", "b", "c"])
    expect(doc.blocks["b"].children).toEqual(["b1"])
  })
})

describe("outdentBlock", () => {
  it("lifts a block to be a sibling of its parent, just after it", () => {
    const next = outdentBlock(fixture(), "b1")
    expect(next.rootBlockIds).toEqual(["a", "b", "b1", "c"])
    expect(next.blocks["b"].children).toEqual([])
  })

  it("is a no-op for a top-level block", () => {
    const doc = fixture()
    expect(outdentBlock(doc, "a")).toBe(doc)
  })

  it("returns the same doc for an unknown id", () => {
    const doc = fixture()
    expect(outdentBlock(doc, "nope")).toBe(doc)
  })

  it("leaves the original doc untouched", () => {
    const doc = fixture()
    outdentBlock(doc, "b1")
    expect(doc.rootBlockIds).toEqual(["a", "b", "c"])
    expect(doc.blocks["b"].children).toEqual(["b1"])
  })

  it("preserves a deeper subtree when outdenting", () => {
    // a > b > b1 > b1a; outdent b1 -> a > [b, b1>b1a]
    const doc: BlockDoc = {
      frontmatter: null,
      rootBlockIds: ["a"],
      blocks: {
        a: { id: "a", content: "A", children: ["b"] },
        b: { id: "b", content: "B", children: ["b1"] },
        b1: { id: "b1", content: "B1", children: ["b1a"] },
        b1a: { id: "b1a", content: "B1A", children: [] },
      },
    }
    const next = outdentBlock(doc, "b1")
    expect(next.blocks["a"].children).toEqual(["b", "b1"])
    expect(next.blocks["b"].children).toEqual([])
    expect(next.blocks["b1"].children).toEqual(["b1a"])
  })
})
