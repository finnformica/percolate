import { Keys } from "./keys"
import { cx } from "../utils/cx"

export interface KeyHintProps {
  /** The key(s) to show in the keycap, e.g. ["X"] or ["⌘", "S"]. */
  keys: string[]
  /** What the shortcut does, e.g. "Check" or "Collapse". */
  label: string
  /** If provided, the hint is a button that performs the action on click. */
  onClick?: () => void
  className?: string
}

/**
 * A discoverable keyboard-shortcut hint: a keycap paired with a short label
 * (e.g. `[X] Check`). Generic and reusable — render several side by side to
 * stack the shortcuts available in a given context.
 */
export function KeyHint({ keys, label, onClick, className }: KeyHintProps) {
  const classes = cx(
    "inline-flex select-none items-center gap-1 text-xs text-text-tertiary",
    onClick && "cursor-pointer hover:text-text-secondary",
    className,
  )
  const content = (
    <>
      <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-bg-secondary px-1 font-sans text-[11px] leading-none text-text-secondary">
        <Keys keys={keys} />
      </kbd>
      <span>{label}</span>
    </>
  )

  return onClick ? (
    <button type="button" tabIndex={-1} onClick={onClick} className={classes}>
      {content}
    </button>
  ) : (
    <span className={classes}>{content}</span>
  )
}
