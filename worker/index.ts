/**
 * Percolate Cloudflare Worker.
 *
 * Serves the built SPA via the ASSETS binding and handles the same API routes
 * that were previously Vercel serverless functions. Which routes reach this
 * Worker is controlled by `assets.run_worker_first` in wrangler.jsonc; anything
 * else is served straight from static assets (with SPA fallback to index.html).
 */
import type { Env } from "./types"
import { corsProxy } from "./handlers/cors-proxy"
import { githubAuth } from "./handlers/github-auth"
import { fileProxy } from "./handlers/file-proxy"
import { gitLfsFile } from "./handlers/git-lfs-file"
import { share } from "./handlers/share"

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname.startsWith("/cors-proxy/")) return corsProxy(request)
    if (pathname === "/github-auth") return githubAuth(request, env)
    if (pathname === "/file-proxy") return fileProxy(request)
    if (pathname === "/git-lfs-file") return gitLfsFile(request)
    if (pathname.startsWith("/share/")) return share(request, env)

    // Everything else: static assets (index.html fallback for SPA routes).
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
