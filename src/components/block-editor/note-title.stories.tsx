import { StoryObj } from "@storybook/react"
import { useState } from "react"
import { NoteTitle } from "./note-title"

/** Stateful harness: renaming updates the name so the story reflects the edit. */
function Harness({ initial }: { initial: string }) {
  const [name, setName] = useState(initial)
  return (
    <div style={{ maxWidth: 640, padding: 24 }}>
      <NoteTitle
        noteId={name}
        onRename={(next) => {
          setName(next)
          return true
        }}
      />
      <pre data-testid="note-name" style={{ position: "fixed", left: -9999, top: 0 }} aria-hidden>
        {name}
      </pre>
    </div>
  )
}

export default {
  title: "NoteTitle",
  component: Harness,
}

type Story = StoryObj<typeof Harness>

export const Default: Story = {
  args: { initial: "Meeting notes" },
}
