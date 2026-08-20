// Proxies a file from an arbitrary URL, e.g. /file-proxy?url=https://…/blob.
// Used when fetching Git LFS blobs client-side.

export async function fileProxy(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const fileUrl = url.searchParams.get("url")

    if (!fileUrl) {
      return new Response("Missing 'url' query parameter", { status: 400 })
    }

    const method = request.method === "HEAD" ? "HEAD" : "GET"
    const response = await fetch(fileUrl, { method })

    if (!response.ok) {
      return new Response(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      })
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"

    return new Response(method === "HEAD" ? null : response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
