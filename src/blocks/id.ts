// Short, URL/markdown-safe block ids. Short enough to embed inline as a block
// reference — `((blk_a1b2c3d4e5))`. Uses the Web Crypto API (available in
// browsers and Node 18+), so no extra dependency.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

export function blockId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let out = ""
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length]
  }
  return `blk_${out}`
}
