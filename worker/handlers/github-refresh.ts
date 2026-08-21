// Exchanges the HttpOnly refresh-token cookie for a fresh access token, so the
// client can keep syncing without a manual re-auth. GitHub rotates the refresh
// token on each use, so we re-set the cookie with the new one every time.
// Reference: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens

import { clearRefreshCookie, readRefreshCookie, refreshCookie } from "../github-cookie"
import type { Env } from "../types"

/** GitHub defaults: access token 8h, refresh token 6 months. */
const DEFAULT_ACCESS_EXPIRES_IN = 28_800
const DEFAULT_REFRESH_EXPIRES_IN = 15_897_600

export async function githubRefresh(request: Request, env: Env): Promise<Response> {
  // Only POST; the SameSite=Lax cookie already blocks cross-site use.
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405)
  }

  const refreshToken = readRefreshCookie(request)
  if (!refreshToken) {
    // No cookie → this session predates refresh support (or was cleared). The
    // client treats a 401 here as "session expired, please sign in again".
    return json({ error: "no_refresh_token" }, 401)
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.VITE_GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  const data = (await response.json()) as {
    error?: string
    access_token?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }

  if (data.error || !data.access_token) {
    // The refresh token is expired or revoked: clear it and tell the client to
    // re-authenticate. Nothing to retry with.
    return json({ error: data.error || "refresh_failed" }, 401, clearRefreshCookie())
  }

  const now = Date.now()
  const accessTokenExpiresAt = now + (data.expires_in ?? DEFAULT_ACCESS_EXPIRES_IN) * 1000
  const refreshTokenExpiresAt =
    now + (data.refresh_token_expires_in ?? DEFAULT_REFRESH_EXPIRES_IN) * 1000

  // Rotate the stored refresh token (GitHub returns a new one each time).
  const setCookie = data.refresh_token
    ? refreshCookie(data.refresh_token, data.refresh_token_expires_in)
    : undefined

  return json(
    { token: data.access_token, accessTokenExpiresAt, refreshTokenExpiresAt },
    200,
    setCookie,
  )
}

function json(body: unknown, status: number, setCookie?: string): Response {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (setCookie) headers.append("Set-Cookie", setCookie)
  return new Response(JSON.stringify(body), { status, headers })
}
