// Client helpers for the GitHub access-token lifecycle. The refresh token lives
// only in an HttpOnly cookie (see worker/github-cookie.ts); here we just ask the
// worker to mint a fresh access token and reason about expiry timestamps.

/** Refresh the access token a bit early so an in-flight sync never 401s. */
export const REFRESH_LEAD_MS = 10 * 60 * 1000 // 10 minutes
/** Warn the user this far before the refresh token's hard expiry. */
export const SESSION_WARN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface RefreshedSession {
  token: string
  accessTokenExpiresAt: number
  refreshTokenExpiresAt: number
}

/** Thrown when the refresh token is gone/expired/revoked and the only recovery
 * is a full re-authentication. Distinct from transient (network) failures. */
export class SessionExpiredError extends Error {
  constructor(message = "GitHub session expired") {
    super(message)
    this.name = "SessionExpiredError"
  }
}

/**
 * Exchange the HttpOnly refresh cookie for a fresh access token via the worker.
 * A 401 means the refresh token itself is dead → `SessionExpiredError` (re-auth
 * required); other failures throw a plain Error (transient, safe to retry).
 */
export async function refreshAccessToken(): Promise<RefreshedSession> {
  const response = await fetch("/github-refresh", {
    method: "POST",
    credentials: "same-origin",
  })
  if (response.status === 401) {
    throw new SessionExpiredError()
  }
  if (!response.ok) {
    throw new Error(`Failed to refresh GitHub token (${response.status})`)
  }
  return (await response.json()) as RefreshedSession
}

/** Does this error look like a GitHub auth rejection (401 / bad credentials)?
 * Covers isomorphic-git's HttpError shape and plain messages. */
export function isAuthError(error: unknown): boolean {
  if (!error) return false
  const e = error as { data?: { statusCode?: number }; status?: number; message?: string }
  const status = e.data?.statusCode ?? e.status
  if (status === 401) return true
  const message = String(e.message ?? error)
  return (
    /\b401\b/.test(message) || /unauthorized/i.test(message) || /bad credentials/i.test(message)
  )
}

/** True when the access token is missing an expiry (treat as fine — dev PAT /
 * non-expiring token) or is within the refresh lead window. */
export function isAccessTokenNearExpiry(expiresAt: number | undefined, now: number): boolean {
  if (!expiresAt) return false
  return now >= expiresAt - REFRESH_LEAD_MS
}

/** True when the refresh token is within the warn window of its hard expiry —
 * the only case (besides revocation) where re-auth becomes unavoidable. */
export function isSessionExpiringSoon(refreshExpiresAt: number | undefined, now: number): boolean {
  if (!refreshExpiresAt) return false
  return now >= refreshExpiresAt - SESSION_WARN_MS
}
