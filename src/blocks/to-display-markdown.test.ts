import { describe, expect, it } from "vitest"
import { toDisplayMarkdown } from "./to-display-markdown"

describe("toDisplayMarkdown", () => {
  it("drops id:: lines and turns todos into GFM task items", () => {
    const stored = ["# 20-08-2026", "  id:: blk_a", "[x] Spider diagram", "  id:: blk_b"].join("\n")
    const md = toDisplayMarkdown(stored)
    expect(md).not.toContain("id::")
    expect(md).not.toContain("blk_")
    expect(md).toContain("# 20-08-2026")
    expect(md).toContain("- [x] Spider diagram")
  })

  it("keeps frontmatter and preserves list nesting", () => {
    const stored = [
      "---",
      "title: t",
      "---",
      "- parent",
      "  id:: blk_a",
      "  - child",
      "    id:: blk_b",
    ].join("\n")
    const md = toDisplayMarkdown(stored)
    expect(md.startsWith("---\ntitle: t\n---")).toBe(true)
    expect(md).toContain("- parent")
    expect(md).toContain("  - child")
  })

  it("separates prose blocks with a blank line", () => {
    const stored = ["First para", "  id:: blk_a", "Second para", "  id:: blk_b"].join("\n")
    expect(toDisplayMarkdown(stored)).toContain("First para\n\nSecond para")
  })
})
