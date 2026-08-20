/**
 * Bindings and variables available to the Worker at runtime.
 *
 * - `ASSETS` serves the built SPA (Workers Static Assets, configured in
 *   wrangler.jsonc). The Worker delegates non-API requests to it.
 * - `VITE_GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` drive the GitHub OAuth
 *   token exchange. The secret must be set with `wrangler secret put`, never
 *   committed.
 */
export interface Env {
  ASSETS: Fetcher
  VITE_GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
}
