const NOTE_ID_REGEX = /^[0-9A-Za-z_.~!$&'()*+,;@{} /-]+$/

export function isValidNoteId(id: string): boolean {
  if (!id) return false
  return NOTE_ID_REGEX.test(id)
}

export function generateNoteId(): string {
  return Date.now().toString()
}

export function getInvalidNoteIdCharacters(id: string): string[] {
  if (!id) return []

  return Array.from(id).filter((char) => !NOTE_ID_REGEX.test(char))
}

/**
 * Turn free text (e.g. what the user typed in the command menu) into a valid
 * note id/filename: drop characters a filename can't contain, collapse runs of
 * whitespace, and trim surrounding whitespace and slashes. Returns "" if
 * nothing usable remains (the caller should fall back to a generated id).
 */
export function toNoteId(text: string): string {
  return Array.from(text)
    .filter((char) => NOTE_ID_REGEX.test(char))
    .join("")
    .replace(/\s+/g, " ")
    .replace(/^[\s/]+|[\s/]+$/g, "")
}
