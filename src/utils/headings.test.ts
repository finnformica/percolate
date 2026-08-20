import { describe, expect, it } from "vitest"
import { getHeadings } from "./headings"

describe("getHeadings", () => {
  it("extracts headings with their levels, in order", () => {
    expect(getHeadings("# Title\n\nsome text\n\n## Section\n### Sub")).toEqual([
      { level: 1, text: "Title" },
      { level: 2, text: "Section" },
      { level: 3, text: "Sub" },
    ])
  })

  it("skips frontmatter so a --- fence isn't treated as content", () => {
    expect(getHeadings("---\ntitle: t\n---\n# Real heading")).toEqual([
      { level: 1, text: "Real heading" },
    ])
  })

  it("ignores non-heading lines and hashes without a space", () => {
    expect(getHeadings("#tag is not a heading\ntext # not either")).toEqual([])
  })

  it("trims trailing closing hashes", () => {
    expect(getHeadings("## Section ##")).toEqual([{ level: 2, text: "Section" }])
  })

  it("returns an empty array when there are no headings", () => {
    expect(getHeadings("just a paragraph\n- a bullet")).toEqual([])
  })
})
