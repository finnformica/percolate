// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { emptyBlock } from "../../blocks/ops"
import { parse } from "../../blocks/parse"
import { serialize } from "../../blocks/serialize"
import type { BlockDoc } from "../../blocks/types"
import { BlockEditor } from "./block-editor"

afterEach(cleanup)

/** Mirror BlockNoteEditor: an empty parse still gets one block to edit. */
function withStarter(doc: BlockDoc): BlockDoc {
  if (doc.rootBlockIds.length > 0) return doc
  const block = emptyBlock()
  return { ...doc, rootBlockIds: [block.id], blocks: { [block.id]: block } }
}

/** A controlled host, like the real note page: it owns the doc and re-renders
 * on change, while the editor keeps its own selection/focus state. */
function Harness({ initial, startEditing }: { initial: string; startEditing?: boolean }) {
  const [doc, setDoc] = useState<BlockDoc>(() => withStarter(parse(initial)))
  return (
    <>
      <BlockEditor doc={doc} onChange={setDoc} startEditing={startEditing} />
      <pre data-testid="serialized">{serialize(doc)}</pre>
    </>
  )
}

/** The editor's root (the focusable select-mode container). */
function editorRoot(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[tabindex="-1"]')!
}

/** Text of the currently highlighted block (the row with the select background). */
function highlightedText(container: HTMLElement): string | null {
  return container.querySelector(".bg-bg-secondary")?.textContent ?? null
}

describe("BlockEditor focus + keyboard", () => {
  it("starts a new note in edit mode with the textarea focused", () => {
    const { container } = render(<Harness initial="" startEditing />)
    const textarea = container.querySelector("textarea")
    expect(textarea).not.toBeNull()
    expect(document.activeElement).toBe(textarea)
  })

  it("focuses the container on mount so a highlighted block responds to keys", () => {
    const { container } = render(<Harness initial={"A\nB\nC"} />)
    expect(document.activeElement).toBe(editorRoot(container))
    // First block highlighted by default.
    expect(highlightedText(container)).toBe("A")
  })

  it("moves the highlight with arrow keys (never scrolling)", () => {
    const { container } = render(<Harness initial={"A\nB\nC"} />)
    const root = editorRoot(container)
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(highlightedText(container)).toBe("B")
    fireEvent.keyDown(root, { key: "ArrowUp" })
    expect(highlightedText(container)).toBe("A")
  })

  it("Cmd+Enter in select mode inserts a new block below and edits it", () => {
    const { container, getByTestId } = render(<Harness initial={"A\nB"} />)
    const root = editorRoot(container)
    fireEvent.keyDown(root, { key: "Enter", metaKey: true })
    // A textarea (edit mode) appears for the fresh block…
    expect(container.querySelector("textarea")).not.toBeNull()
    // …and the doc gained a block after A.
    const lines = getByTestId("serialized").textContent!.split("\n").filter(Boolean).length
    expect(lines).toBeGreaterThan(2)
  })

  it("re-highlights a deleted block after undo", () => {
    const { container } = render(<Harness initial={"A\nB\nC"} />)
    const root = editorRoot(container)
    fireEvent.keyDown(root, { key: "ArrowDown" }) // highlight B
    expect(highlightedText(container)).toBe("B")
    fireEvent.keyDown(root, { key: "Backspace" }) // delete B
    expect(highlightedText(container)).not.toBe("B")
    fireEvent.keyDown(root, { key: "z", metaKey: true }) // undo
    expect(highlightedText(container)).toBe("B")
  })

  it("hands off from the title into the first block editing when mode is edit", () => {
    // focusFirstSignal truthy on mount fires the hand-off effect once; mode
    // "edit" should open the first block's textarea (title was being edited).
    const { container } = render(
      <BlockEditor
        doc={withStarter(parse("A\nB"))}
        onChange={() => {}}
        focusFirstSignal={1}
        focusFirstMode="edit"
      />,
    )
    expect(container.querySelector("textarea")).not.toBeNull()
  })

  it("hands off from the title into the first block highlighted when mode is select", () => {
    const { container } = render(
      <BlockEditor
        doc={withStarter(parse("A\nB"))}
        onChange={() => {}}
        focusFirstSignal={1}
        focusFirstMode="select"
      />,
    )
    expect(container.querySelector("textarea")).toBeNull()
    expect(highlightedText(container)).toBe("A")
  })

  it("extends a multi-block selection with Shift+Arrow", () => {
    const { container } = render(<Harness initial={"A\nB\nC"} />)
    const root = editorRoot(container)
    fireEvent.keyDown(root, { key: "ArrowDown", shiftKey: true })
    const highlighted = Array.from(container.querySelectorAll(".bg-bg-secondary")).map(
      (el) => el.textContent,
    )
    expect(highlighted).toEqual(["A", "B"])
  })
})
