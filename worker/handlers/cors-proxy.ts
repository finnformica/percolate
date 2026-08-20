// Relays isomorphic-git's HTTP(S) requests to GitHub so the browser can do
// git-over-http (which is otherwise blocked by CORS). Same-origin with the
// app, so no CORS response headers are needed.
// Reference: https://github.com/isomorphic-git/cors-proxy

const ALLOW_HEADERS = [
  "accept-encoding",
  "accept-language",
  "accept",
  "access-control-allow-origin",
  "authorization",
  "cache-control",
  "connection",
  "content-length",
  "content-type",
  "dnt",
  "git-protocol",
  "pragma",
  "range",
  "referer",
  "user-agent",
  "x-authorization",
  "x-http-method-override",
  "x-requested-with",
]

const EXPOSE_HEADERS = [
  "accept-ranges",
  "age",
  "cache-control",
  "content-length",
  "content-language",
  "content-type",
  "date",
  "etag",
  "expires",
  "last-modified",
  "location",
  "pragma",
  "server",
  "transfer-encoding",
  "vary",
  "x-github-request-id",
  "x-redirected-url",
]

export async function corsProxy(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)

    // The target is encoded in the path: /cors-proxy/<host>/<path...>
    const path = url.pathname.replace(/^\/cors-proxy\//, "")
    if (!path) {
      return new Response("Missing target path", { status: 400 })
    }

    const targetUrl = new URL(`https://${path}`)
    targetUrl.search = url.search // forward the git query (e.g. ?service=...)

    const requestHeaders = new Headers()
    for (const [key, value] of request.headers.entries()) {
      if (ALLOW_HEADERS.includes(key.toLowerCase())) {
        requestHeaders.set(key, value)
      }
    }

    // GitHub behaves differently if the user-agent starts with "git/".
    requestHeaders.set("user-agent", "git/percolate/cors-proxy")

    const fetchOptions: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers: requestHeaders,
    }

    if (request.body) {
      fetchOptions.body = request.body
      fetchOptions.duplex = "half"
    }

    const response = await fetch(targetUrl, fetchOptions)

    const responseHeaders = new Headers()
    for (const [key, value] of response.headers.entries()) {
      if (EXPOSE_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
