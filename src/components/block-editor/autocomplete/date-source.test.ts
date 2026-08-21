import { describe, expect, it } from "vitest"
import { dateCompletionSource } from "./date-source"

/** Run the source with the caret at the end of `text` (| marks the caret if present). */
function run(text: string) {
  const caret = text.includes("|") ? text.indexOf("|") : text.length
  return dateCompletionSource({ text: text.replace("|", ""), caret })
}

describe("dateCompletionSource", () => {
  it("offers a resolved daily-note link for a natural-language date", () => {
    const match = run("[[today")
    expect(match).not.toBeNull()
    expect(match!.from).toBe(0)
    const apply = match!.options[0].apply({ from: match!.from, to: match!.to })
    expect(apply.insert).toMatch(/^\[\[\d{4}-\d{2}-\d{2}\]\]$/)
    expect(apply.caret).toBe(apply.insert.length)
  })

  it("anchors at the [[ even mid-line", () => {
    const match = run("see [[tomorrow")
    expect(match!.from).toBe(4)
  })

  it("swallows an existing closing ]] after the caret", () => {
    const match = run("[[tomorrow|]]")
    // caret sits before ]]; the replace range should extend past it.
    expect(match!.to).toBe("[[tomorrow".length + 2)
  })

  it("does not trigger on an empty query", () => {
    expect(run("[[")).toBeNull()
  })

  it("does not re-offer an already-resolved date", () => {
    expect(run("[[2026-08-24")).toBeNull()
  })

  it("ignores non-date text", () => {
    expect(run("[[Roadmap")).toBeNull()
  })

  it("does not trigger outside a wikilink", () => {
    expect(run("just today thoughts")).toBeNull()
  })
})
