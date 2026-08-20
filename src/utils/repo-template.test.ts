import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildRepoTemplateFiles } from "./repo-template"

function findFile(path: string) {
  const file = buildRepoTemplateFiles().find((f) => f.path === path)
  if (!file) throw new Error(`Expected a template file at ${path}`)
  return file
}

describe("repo template", () => {
  it("seeds the workflow, gitattributes, and a welcome note", () => {
    const paths = buildRepoTemplateFiles().map((f) => f.path)
    expect(paths).toContain(".github/workflows/prune-uploads.yml")
    expect(paths).toContain(".gitattributes")
    // The welcome note is named with a generated numeric id.
    expect(paths.some((p) => /^\d+\.md$/.test(p))).toBe(true)
  })

  it("carries the prune-uploads workflow byte-for-byte from the upstream template", () => {
    const bytes = Buffer.from(findFile(".github/workflows/prune-uploads.yml").base64, "base64")
    const sha = createHash("sha256").update(bytes).digest("hex")
    // sha256 of lumen-notes/notes-template's .github/workflows/prune-uploads.yml
    expect(sha).toBe("88b1666a7683def44fa75f2d206ccd2bc65e99e78e463640aa4f72ccffd78f18")
  })

  it("decodes .gitattributes to the expected Git LFS rule", () => {
    const text = Buffer.from(findFile(".gitattributes").base64, "base64").toString("utf8")
    expect(text).toBe("uploads/** filter=lfs diff=lfs merge=lfs -text\n")
  })

  it("encodes the welcome note as valid base64 that decodes to markdown", () => {
    const note = buildRepoTemplateFiles().find((f) => /^\d+\.md$/.test(f.path))
    if (!note) throw new Error("Expected a welcome note")
    const text = Buffer.from(note.base64, "base64").toString("utf8")
    expect(text).toContain("# 👋 Welcome to Ruminate")
    expect(text.startsWith("---\n")).toBe(true)
  })
})
