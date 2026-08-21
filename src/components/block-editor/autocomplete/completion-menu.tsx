import { cx } from "../../../utils/cx"
import type { ActiveCompletion } from "./engine"

/**
 * The autocomplete popup, anchored at the caret. Purely presentational — it
 * renders whatever options the active sources produced, so new completion types
 * need no changes here. Mouse-down is prevented so clicking an option doesn't
 * blur the textarea before the click registers.
 */
export function CompletionMenu({
  active,
  index,
  position,
  onSelect,
}: {
  active: ActiveCompletion
  index: number
  position: { top: number; left: number }
  onSelect: (optionIndex: number) => void
}) {
  return (
    <ul
      role="listbox"
      className="absolute z-20 max-h-64 w-64 overflow-y-auto rounded-md border border-border-secondary bg-bg-overlay py-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {active.options.map((option, i) => (
        <li key={option.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === index}
            className={cx(
              "flex w-full items-center gap-2 px-2 py-1 text-left text-sm",
              i === index ? "bg-bg-secondary" : "hover:bg-bg-hover",
            )}
            onClick={() => onSelect(i)}
          >
            {option.icon ? (
              <span className="flex shrink-0 text-text-secondary">{option.icon}</span>
            ) : null}
            <span className="truncate">{option.label}</span>
            {option.detail ? (
              <span className="ml-auto shrink-0 pl-2 text-xs text-text-tertiary">
                {option.detail}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
