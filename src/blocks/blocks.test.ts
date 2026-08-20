import { describe, expect, it } from "vitest"
import { parse } from "./parse"
import { serialize } from "./serialize"

const CANONICAL = `---
title: My note
---
- A block
  id:: blk_aaa
  - A nested block
    id:: blk_bbb
- [ ] a todo
  id:: blk_ccc
- References ((blk_aaa))
  id:: blk_ddd
`

describe("block round-trip", () => {
  it("serialize(parse(x)) === x for canonical markdown", () => {
    expect(serialize(parse(CANONICAL))).toBe(CANONICAL)
  })

  it("parses the outline structure and ids", () => {
    const doc = parse(CANONICAL)
    expect(doc.frontmatter).toBe("title: My note")
    expect(doc.rootBlockIds).toEqual(["blk_aaa", "blk_ccc", "blk_ddd"])
    expect(doc.blocks["blk_aaa"].content).toBe("A block")
    expect(doc.blocks["blk_aaa"].children).toEqual(["blk_bbb"])
    expect(doc.blocks["blk_bbb"].content).toBe("A nested block")
  })

  it("preserves block references verbatim in content", () => {
    const doc = parse(CANONICAL)
    expect(doc.blocks["blk_ddd"].content).toBe("References ((blk_aaa))")
  })

  it("preserves empty blocks", () => {
    const md = `- \n  id:: blk_x\n`
    const doc = parse(md)
    expect(doc.blocks["blk_x"].content).toBe("")
    // Empty content serializes without a trailing "- " space.
    expect(serialize(doc)).toBe(`-\n  id:: blk_x\n`)
  })

  it("mints ids for id-less markdown, then is stable across a round-trip", () => {
    const doc1 = parse(`- first\n- second\n`)
    // Both blocks got minted ids.
    expect(doc1.rootBlockIds).toHaveLength(2)
    for (const id of doc1.rootBlockIds) expect(id).toMatch(/^blk_[0-9a-z]{10}$/)
    // Once serialized (ids written), re-parsing keeps the same ids.
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)
    expect(doc2.rootBlockIds).toEqual(doc1.rootBlockIds)
    expect(serialize(doc2)).toBe(serialized)
  })

  it("imports non-outline lines as top-level blocks", () => {
    const doc = parse(`# A heading\nA loose paragraph\n`)
    expect(doc.rootBlockIds).toHaveLength(2)
    const contents = doc.rootBlockIds.map((id) => doc.blocks[id].content)
    expect(contents).toEqual(["# A heading", "A loose paragraph"])
  })
})

describe("frontmatter handling", () => {
  it("returns null frontmatter when there is none", () => {
    const doc = parse(`- just a block\n  id:: blk_x\n`)
    expect(doc.frontmatter).toBeNull()
    // No `---` fences appear in the output.
    expect(serialize(doc)).toBe(`- just a block\n  id:: blk_x\n`)
  })

  it("preserves multi-line YAML verbatim, including lines that look like bullets", () => {
    // The `- foo` / `- bar` lines live *inside* the fence: they must be kept as
    // frontmatter text, never parsed as outline blocks.
    const md = `---
title: My note
tags:
  - foo
  - bar
date: 2026-08-20
---
- A block
  id:: blk_x
`
    const doc = parse(md)
    expect(doc.frontmatter).toBe("title: My note\ntags:\n  - foo\n  - bar\ndate: 2026-08-20")
    // Only the real body block is parsed.
    expect(doc.rootBlockIds).toEqual(["blk_x"])
    expect(serialize(doc)).toBe(md)
  })

  it("preserves an empty frontmatter block round-trip", () => {
    const md = `---\n\n---\n- A block\n  id:: blk_x\n`
    const doc = parse(md)
    expect(doc.frontmatter).toBe("")
    expect(serialize(doc)).toBe(md)
  })

  it("keeps a `---` that appears in the body as block content", () => {
    // Only a *leading* fence is frontmatter; a later `---` is ordinary content.
    const doc = parse(`- above\n  id:: blk_a\n- ---\n  id:: blk_b\n`)
    expect(doc.frontmatter).toBeNull()
    expect(doc.blocks["blk_b"].content).toBe("---")
  })
})

describe("nesting", () => {
  it("round-trips three levels of nesting", () => {
    const md = `- one
  id:: blk_1
  - two
    id:: blk_2
    - three
      id:: blk_3
`
    const doc = parse(md)
    expect(doc.rootBlockIds).toEqual(["blk_1"])
    expect(doc.blocks["blk_1"].children).toEqual(["blk_2"])
    expect(doc.blocks["blk_2"].children).toEqual(["blk_3"])
    expect(doc.blocks["blk_3"].children).toEqual([])
    expect(serialize(doc)).toBe(md)
  })

  it("attaches a child to the nearest shallower ancestor when indentation jumps", () => {
    // `two` is indented four spaces (depth 2) directly under `one` (depth 0);
    // it should still nest under `one` rather than be dropped.
    const doc = parse(`- one\n    - two\n`)
    expect(doc.rootBlockIds).toHaveLength(1)
    const oneId = doc.rootBlockIds[0]
    expect(doc.blocks[oneId].content).toBe("one")
    expect(doc.blocks[oneId].children).toHaveLength(1)
    const twoId = doc.blocks[oneId].children[0]
    expect(doc.blocks[twoId].content).toBe("two")
  })

  it("pops back to a shallower level correctly", () => {
    const doc = parse(`- a\n  - a1\n- b\n`)
    expect(doc.rootBlockIds).toHaveLength(2)
    const [aId, bId] = doc.rootBlockIds
    expect(doc.blocks[aId].content).toBe("a")
    expect(doc.blocks[aId].children).toHaveLength(1)
    expect(doc.blocks[bId].content).toBe("b")
    expect(doc.blocks[bId].children).toEqual([])
  })
})

describe("content preservation", () => {
  it("keeps markdown syntax untouched in block content", () => {
    const md = `- # A heading
  id:: blk_a
- **bold** and _italic_ and \`code\`
  id:: blk_b
- [ ] unchecked
  id:: blk_c
- [x] checked
  id:: blk_d
- > a quote
  id:: blk_e
- [a link](https://example.com)
  id:: blk_f
`
    const doc = parse(md)
    expect(doc.blocks["blk_a"].content).toBe("# A heading")
    expect(doc.blocks["blk_b"].content).toBe("**bold** and _italic_ and `code`")
    expect(doc.blocks["blk_c"].content).toBe("[ ] unchecked")
    expect(doc.blocks["blk_d"].content).toBe("[x] checked")
    expect(doc.blocks["blk_e"].content).toBe("> a quote")
    expect(doc.blocks["blk_f"].content).toBe("[a link](https://example.com)")
    expect(serialize(doc)).toBe(md)
  })

  it("does not treat a bullet whose text starts with `id::` as an id line", () => {
    // The id-line check requires no leading bullet; `- id:: x` is real content.
    const doc = parse(`- id:: not an id line\n  id:: blk_a\n`)
    expect(doc.rootBlockIds).toEqual(["blk_a"])
    expect(doc.blocks["blk_a"].content).toBe("id:: not an id line")
  })
})

describe("whitespace and line endings", () => {
  it("normalizes CRLF so ids and content never carry a stray \\r", () => {
    const md = `---\r\ntitle: t\r\n---\r\n- a block\r\n  id:: blk_a\r\n  - child\r\n    id:: blk_b\r\n`
    const doc = parse(md)
    expect(doc.frontmatter).toBe("title: t")
    expect(doc.blocks["blk_a"].content).toBe("a block")
    expect(doc.blocks["blk_a"].children).toEqual(["blk_b"])
    expect(doc.blocks["blk_b"].content).toBe("child")
    // Serializes with clean LF-only output.
    expect(serialize(doc)).toBe(
      `---\ntitle: t\n---\n- a block\n  id:: blk_a\n  - child\n    id:: blk_b\n`,
    )
  })

  it("ignores blank lines between blocks", () => {
    const doc = parse(`- a\n  id:: blk_a\n\n- b\n  id:: blk_b\n`)
    expect(doc.rootBlockIds).toEqual(["blk_a", "blk_b"])
  })

  it("parses an empty document to an empty doc", () => {
    const doc = parse("")
    expect(doc.frontmatter).toBeNull()
    expect(doc.rootBlockIds).toEqual([])
    expect(doc.blocks).toEqual({})
  })

  it("parses a whitespace-only document to an empty doc", () => {
    const doc = parse("   \n\n  \n")
    expect(doc.rootBlockIds).toEqual([])
    expect(doc.blocks).toEqual({})
  })
})
