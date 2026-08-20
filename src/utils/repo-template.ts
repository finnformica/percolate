import { generateNoteId } from "./note-id"

/**
 * Scaffolding for a newly created notes repository.
 *
 * We reproduce the structure of `lumen-notes/notes-template` ourselves instead
 * of using GitHub's "generate from template" API: that template lives in an org
 * which restricts third-party OAuth apps, so our app can't read it (users hit an
 * "OAuth App access restrictions" error). Seeding the files directly through the
 * contents API sidesteps that entirely.
 *
 * The workflow and `.gitattributes` are stored as verbatim, byte-for-byte base64
 * of the upstream template files. Base64 because the workflow's shell script
 * contains backticks, `${…}`, and literal `\n` that don't survive hand-copying
 * into a TS string — and because the contents API wants base64 anyway.
 */

// .github/workflows/prune-uploads.yml — weekly Action that opens a PR removing
// upload files no markdown note references.
const PRUNE_UPLOADS_WORKFLOW_BASE64 =
  "bmFtZTogRGVsZXRlIHVucmVmZXJlbmNlZCB1cGxvYWRzCgpvbjoKICB3b3JrZmxvd19kaXNwYXRjaDoKICBzY2hlZHVsZToKICAgIC0gY3JvbjogJzAgMCAqICogMScgIyBFdmVyeSBNb25kYXkKCnBlcm1pc3Npb25zOgogIGNvbnRlbnRzOiB3cml0ZQogIHB1bGwtcmVxdWVzdHM6IHdyaXRlCgpqb2JzOgogIHBydW5lOgogICAgcnVucy1vbjogdWJ1bnR1LWxhdGVzdAogICAgc3RlcHM6CiAgICAgIC0gbmFtZTogQ2hlY2sgb3V0IHJlcG9zaXRvcnkKICAgICAgICB1c2VzOiBhY3Rpb25zL2NoZWNrb3V0QHYzCgogICAgICAtIG5hbWU6IERlbGV0ZSB1bnJlZmVyZW5jZWQgdXBsb2FkcwogICAgICAgIGlkOiBkZWxldGUtZmlsZXMKICAgICAgICBzaGVsbDogYmFzaAogICAgICAgIHJ1bjogfAogICAgICAgICAgZWNobyAiU3RhcnRpbmcgdG8gcHJvY2VzcyB1bnJlZmVyZW5jZWQgdXBsb2Fkcy4uLiIKCiAgICAgICAgICAjIFdlJ2xsIGNvbnN0cnVjdCBjYW5vbmljYWwgVVJMcyBwb2ludGluZyB0byB0aGUgY3VycmVudCBjb21taXQKICAgICAgICAgIEdIX0NBTk9OSUNBTF9VUkw9Imh0dHBzOi8vZ2l0aHViLmNvbS8ke0dJVEhVQl9SRVBPU0lUT1JZfS9ibG9iLyR7R0lUSFVCX1NIQX0iCgogICAgICAgICAgREVMRVRFRF9GSUxFU19MSVNUPSIiCgogICAgICAgICAgIyBGaW5kIGFsbCBmaWxlcyBpbiB1cGxvYWRzIGFuZCBzb3J0IGJ5IGRlc2NlbmRpbmcgbmFtZQogICAgICAgICAgd2hpbGUgSUZTPSByZWFkIC1yIC1kICcnIGZpbGU7IGRvCiAgICAgICAgICAgIGJhc2VmaWxlPSQoYmFzZW5hbWUgIiRmaWxlIikKICAgICAgICAgICAgZWNobyAiQ2hlY2tpbmcgZmlsZTogJGZpbGUiCgogICAgICAgICAgICAjIFNlYXJjaCBmb3IgdGhlIGZpbGUncyBmdWxsIHBhdGggb3IganVzdCBpdHMgYmFzZW5hbWUgaW4gTWFya2Rvd24gZmlsZXMKICAgICAgICAgICAgaWYgZ3JlcCAtUnEgIiRmaWxlIiAuIC0taW5jbHVkZT0iKi5tZCIgfHwgZ3JlcCAtUnEgIiRiYXNlZmlsZSIgLiAtLWluY2x1ZGU9IioubWQiOyB0aGVuCiAgICAgICAgICAgICAgZWNobyAiICAtPiBGaWxlIGlzIHJlZmVyZW5jZWQuIFNraXBwaW5nLiIKICAgICAgICAgICAgZWxzZQogICAgICAgICAgICAgIGVjaG8gIiAgLT4gRmlsZSBpcyBOT1QgcmVmZXJlbmNlZC4gRGVsZXRpbmcuLi4iCiAgICAgICAgICAgICAgIyBBcHBlbmQgYSBidWxsZXQgcG9pbnQgd2l0aCBhIGxpbmsgdG8gdGhlIGZpbGUgaW4gR2l0SHViCiAgICAgICAgICAgICAgREVMRVRFRF9GSUxFU19MSVNUKz0iLSBbXGAkZmlsZVxgXSgkR0hfQ0FOT05JQ0FMX1VSTC8kZmlsZSlcbiIKICAgICAgICAgICAgICBybSAiJGZpbGUiCiAgICAgICAgICAgICAgZWNobyAiRGVsZXRlZDogJGZpbGUiCiAgICAgICAgICAgIGZpCiAgICAgICAgICBkb25lIDwgPChmaW5kIHVwbG9hZHMgLXR5cGUgZiAtcHJpbnQwIHwgc29ydCAteiAtcikKCiAgICAgICAgICAjIE9ubHkgc2V0IG91dHB1dCBpZiBmaWxlcyB3ZXJlIGRlbGV0ZWQKICAgICAgICAgIGlmIFsgISAteiAiJERFTEVURURfRklMRVNfTElTVCIgXTsgdGhlbgogICAgICAgICAgICBlY2hvICJkZWxldGVkX2ZpbGVzPDxFT0YiID4+ICRHSVRIVUJfT1VUUFVUCiAgICAgICAgICAgIHByaW50ZiAiJWIiICIkREVMRVRFRF9GSUxFU19MSVNUIiA+PiAkR0lUSFVCX09VVFBVVAogICAgICAgICAgICBlY2hvICJFT0YiID4+ICRHSVRIVUJfT1VUUFVUCiAgICAgICAgICBmaQoKICAgICAgLSBuYW1lOiBDcmVhdGUgcHVsbCByZXF1ZXN0CiAgICAgICAgaWY6IHN0ZXBzLmRlbGV0ZS1maWxlcy5vdXRwdXRzLmRlbGV0ZWRfZmlsZXMgIT0gJycKICAgICAgICB1c2VzOiBwZXRlci1ldmFucy9jcmVhdGUtcHVsbC1yZXF1ZXN0QHY3CiAgICAgICAgd2l0aDoKICAgICAgICAgIGNvbW1pdC1tZXNzYWdlOiAiRGVsZXRlIHVucmVmZXJlbmNlZCB1cGxvYWRzIgogICAgICAgICAgdGl0bGU6ICJEZWxldGUgdW5yZWZlcmVuY2VkIHVwbG9hZHMiCiAgICAgICAgICBib2R5OiB8CiAgICAgICAgICAgIFRoaXMgUFIgZGVsZXRlcyBmaWxlcyBmcm9tIHRoZSB1cGxvYWRzIGRpcmVjdG9yeSB0aGF0IGFyZSBub3QgcmVmZXJlbmNlZCBpbiBhbnkgbWFya2Rvd24gZmlsZXMuCiAgICAgICAgICAgIAogICAgICAgICAgICBUaGUgZm9sbG93aW5nIGZpbGVzIHdlcmUgZGVsZXRlZDoKICAgICAgICAgICAgJHt7IHN0ZXBzLmRlbGV0ZS1maWxlcy5vdXRwdXRzLmRlbGV0ZWRfZmlsZXMgfX0KICAgICAgICAgIGJyYW5jaDogYWN0aW9ucy9wcnVuZS11cGxvYWRzCiAgICAgICAgICBkZWxldGUtYnJhbmNoOiB0cnVlCg=="

// .gitattributes — route uploads through Git LFS, matching the template.
const GITATTRIBUTES_BASE64 = "dXBsb2Fkcy8qKiBmaWx0ZXI9bGZzIGRpZmY9bGZzIG1lcmdlPWxmcyAtdGV4dAo="

// A first note so a fresh repo isn't empty. Plain markdown; the app treats every
// `.md` file as a note (the filename is its id).
const WELCOME_NOTE = `---
pinned: true
---

# 👋 Welcome to Ruminate

This is your first note. Your notes are plain Markdown files in your own GitHub
repository — edit them here or on GitHub and they stay in sync.

Things to try:

- [ ] Write a note and watch it sync to GitHub
- [ ] Link to another note with [[double brackets]]
- [ ] Add a #tag to organize your notes
- [ ] Open a note in the experimental block editor
`

interface RepoTemplateFile {
  path: string
  /** File content, base64-encoded (the shape the GitHub contents API expects). */
  base64: string
}

/** UTF-8-safe base64 (handles emoji and other multi-byte characters). */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** The files seeded into a new repo. The welcome note is given a fresh id. */
export function buildRepoTemplateFiles(): RepoTemplateFile[] {
  return [
    { path: ".github/workflows/prune-uploads.yml", base64: PRUNE_UPLOADS_WORKFLOW_BASE64 },
    { path: ".gitattributes", base64: GITATTRIBUTES_BASE64 },
    { path: `${generateNoteId()}.md`, base64: toBase64(WELCOME_NOTE) },
  ]
}

const GITHUB_HEADERS = (token: string) => ({
  Authorization: `token ${token}`,
  Accept: "application/vnd.github+json",
})

/**
 * Commit the scaffold files into a freshly created repo via the contents API.
 * Each PUT is one commit on the default branch; failures throw so the caller can
 * surface them. The repo must already have an initial commit (created with
 * `auto_init`) so the default branch exists.
 */
export async function seedRepoTemplate(owner: string, name: string, token: string): Promise<void> {
  for (const file of buildRepoTemplateFiles()) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/${file.path}`,
      {
        method: "PUT",
        headers: GITHUB_HEADERS(token),
        body: JSON.stringify({ message: `Add ${file.path}`, content: file.base64 }),
      },
    )

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { message } = (await response.json().catch(() => ({}))) as any
      throw new Error(message || `Failed to add ${file.path} to the repository.`)
    }
  }
}

/**
 * Best-effort removal of the README that `auto_init` creates. The template has
 * no README, and the app would otherwise list it as a note. Any failure here is
 * cosmetic, so errors are swallowed.
 */
export async function removeAutoInitReadme(
  owner: string,
  name: string,
  token: string,
): Promise<void> {
  try {
    const url = `https://api.github.com/repos/${owner}/${name}/contents/README.md`
    const get = await fetch(url, { headers: GITHUB_HEADERS(token) })
    if (!get.ok) return
    const { sha } = (await get.json()) as { sha?: string }
    if (!sha) return
    await fetch(url, {
      method: "DELETE",
      headers: GITHUB_HEADERS(token),
      body: JSON.stringify({ message: "Remove default README", sha }),
    })
  } catch {
    // ignore — a stray README is harmless
  }
}
