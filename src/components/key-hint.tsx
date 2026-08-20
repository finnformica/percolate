import { Keys } from "./keys"
import { cx } from "../utils/cx"

export interface KeyHintProps {
  /** The key(s) to show in the keycap, e.g. ["X"] or ["⌘", "S"]. */
  keys: string[]
  /** Accessible name / hover tooltip describing what the shortcut does. */
  title?: string
  /** If provided, the keycap is a button that performs the action on click. */
  onClick?: () => void
  className?: string
}

/**
 * A single keyboard-shortcut keycap, styled like the small keys apps such as
 * GitHub and Linear render inline: a bordered, subtly raised cap. Just the key
 * — the meaning is carried by the `title` tooltip, not a visible label. Render
 * several side by side to show the shortcuts available in a context.
 */
export function KeyHint({ keys, title, onClick, className }: KeyHintProps) {
  const cap = (
    <kbd
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-bg-card px-1 text-[11px] font-medium leading-none text-text-secondary shadow-sm",
        onClick && "transition-colors hover:border-border-focus hover:text-text",
      )}
    >
      <Keys keys={keys} />
    </kbd>
  )

  return onClick ? (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx("inline-flex cursor-pointer", className)}
    >
      {cap}
    </button>
  ) : (
    <span className={cx("inline-flex", className)} title={title}>
      {cap}
    </span>
  )
}
