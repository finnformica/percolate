// Resolves (GET) and uploads (POST) Git LFS objects using the caller's GitHub
// token. Reference: https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md

type LfsUploadRequest = {
  repo: string
  content: string
  oid: string
  size: number
}

/** base64 → bytes, avoiding a dependency on Node's Buffer in the Worker. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function gitLfsFile(request: Request): Promise<Response> {
  return request.method === "POST" ? uploadLfsFile(request) : resolveLfsPointer(request)
}

/** Resolves a Git LFS pointer to the actual file download URL. */
async function resolveLfsPointer(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const repo = url.searchParams.get("repo")
    const pointer = url.searchParams.get("pointer")
    const authorization = request.headers.get("authorization")

    if (!repo || !pointer || !authorization) {
      throw new Error("Invalid request")
    }

    const oid = pointer.match(/oid sha256:(?<oid>[a-f0-9]{64})/)?.groups?.oid
    const size = parseInt(pointer.match(/size (?<size>\d+)/)?.groups?.size ?? "0")

    if (!oid || !Number.isFinite(size)) {
      throw new Error("Invalid pointer")
    }

    const response = await fetch(`https://github.com/${repo}.git/info/lfs/objects/batch`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        operation: "download",
        transfers: ["basic"],
        objects: [{ oid, size }],
      }),
    })

    if (!response.ok) {
      throw new Error("Unable to resolve Git LFS pointer")
    }

    const json = (await response.json()) as {
      objects: { actions: { download: { href: string } } }[]
    }
    const href = json.objects[0].actions.download.href

    return new Response(href, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(`Error: ${message}`, { status: 500 })
  }
}

/** Uploads a file to Git LFS storage. */
async function uploadLfsFile(request: Request): Promise<Response> {
  try {
    const { repo, content, oid, size } = (await request.json()) as LfsUploadRequest
    const authorization = request.headers.get("authorization")

    if (
      typeof repo !== "string" ||
      typeof content !== "string" ||
      typeof oid !== "string" ||
      typeof size !== "number" ||
      !authorization
    ) {
      throw new Error("Invalid request")
    }

    const binaryContent = base64ToBytes(content)

    const response = await fetch(`https://github.com/${repo}.git/info/lfs/objects/batch`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        operation: "upload",
        transfers: ["basic"],
        objects: [{ oid, size }],
      }),
    })

    if (!response.ok) {
      throw new Error("Unable to resolve Git LFS pointer")
    }

    const json = (await response.json()) as {
      objects: {
        actions: {
          upload: { href: string; header?: Record<string, string> }
          verify: { href: string; header?: Record<string, string> }
        }
      }[]
    }
    const { upload, verify } = json.objects[0].actions

    const uploadResponse = await fetch(upload.href, {
      method: "PUT",
      headers: {
        ...upload.header,
        "Content-Type": "application/octet-stream",
      },
      body: binaryContent,
    })

    if (!uploadResponse.ok) {
      throw new Error("Unable to upload file")
    }

    const verifyResponse = await fetch(verify.href, {
      method: "POST",
      headers: verify.header,
      body: JSON.stringify({ oid, size }),
    })

    if (!verifyResponse.ok) {
      throw new Error("Unable to verify upload")
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
