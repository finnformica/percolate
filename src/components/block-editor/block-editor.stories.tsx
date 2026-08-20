import { StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"
import { useState } from "react"
import { emptyBlock } from "../../blocks/ops"
import { parse } from "../../blocks/parse"
import { serialize } from "../../blocks/serialize"
import type { BlockDoc } from "../../blocks/types"
import { BlockEditor } from "./block-editor"

/** Ensure a parsed doc always has at least one block to edit. */
function withStarterBlock(doc: BlockDoc): BlockDoc {
  if (doc.rootBlockIds.length > 0) return doc
  const block = emptyBlock()
  return { ...doc, rootBlockIds: [block.id], blocks: { [block.id]: block } }
}

/**
 * Stateful harness so the block editor can be exercised in isolation (no auth,
 * no GitHub). The serialized markdown is exposed for assertions.
 */
function Harness({ initial }: { initial: string }) {
  const [doc, setDoc] = useState<BlockDoc>(() => withStarterBlock(parse(initial)))
  return (
    <div style={{ maxWidth: 640, padding: 24 }}>
      <BlockEditor doc={doc} onChange={setDoc} />
      <pre data-testid="serialized" style={{ position: "fixed", left: -9999, top: 0 }} aria-hidden>
        {serialize(doc)}
      </pre>
    </div>
  )
}

const SAMPLE = `# Project ideas
  id:: blk_h1
Some intro text
  id:: blk_p1
- A bullet point
  id:: blk_b1
  - A nested bullet
    id:: blk_b2
[ ] A todo
  id:: blk_t1
[x] A done todo
  id:: blk_t2
> A quote
  id:: blk_q1
`

export default {
  title: "BlockEditor",
  component: Harness,
}

type Story = StoryObj<typeof Harness>

/** Visual reference: mixed block types render as a document, not an outline. */
export const Mixed: Story = {
  args: { initial: SAMPLE },
}

export const Empty: Story = {
  args: { initial: "" },
}

const serialized = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-testid="serialized"]')?.textContent ?? ""

/** Typing `# ` promotes a block to a heading, and `- ` to a single bullet. */
export const MarkdownShortcuts: Story = {
  args: { initial: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The first (empty) block starts selected — Enter to edit it.
    await userEvent.keyboard("{Enter}")
    const textarea = await canvas.findByRole("textbox")
    await userEvent.type(textarea, "# Heading one")

    // Rendered as a heading (no visible `#`), serialized with one `# `.
    await waitFor(() => expect(serialized(canvasElement)).toContain("# Heading one"))

    // New paragraph, then a bullet — the bullet keeps exactly one `- `.
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("- Bullet one")
    await waitFor(() => {
      const md = serialized(canvasElement)
      expect(md).toContain("- Bullet one")
      expect(md).not.toContain("- - Bullet one")
    })
  },
}

/** A todo shortcut renders an interactive checkbox. */
export const TodoShortcut: Story = {
  args: { initial: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.keyboard("{Enter}")
    const textarea = await canvas.findByRole("textbox")
    await userEvent.type(textarea, "[] Buy milk")
    await userEvent.keyboard("{Escape}")

    const checkbox = await canvas.findByRole("checkbox")
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    await waitFor(() => expect(serialized(canvasElement)).toContain("[x] Buy milk"))
  },
}

/** Arrow keys move a highlight; the text position is identical in view/edit. */
export const SeamlessViewEdit: Story = {
  args: { initial: SAMPLE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const heading = await canvas.findByText("Project ideas")
    const viewLeft = heading.getBoundingClientRect().left

    await userEvent.click(heading)
    await userEvent.keyboard("{Enter}")
    const textarea = await canvas.findByRole("textbox")
    const editLeft = textarea.getBoundingClientRect().left

    // Entering edit mode must not shift the text horizontally.
    expect(Math.abs(viewLeft - editLeft)).toBeLessThanOrEqual(2)
  },
}
