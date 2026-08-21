// The GitHub refresh token is the long-lived, sensitive credential. It is kept
// out of client JS entirely by living only in this HttpOnly cookie, set by the
// OAuth callback and rotated by `/github-refresh`. SameSite=Lax means it is not
// sent on cross-site requests, which blocks CSRF against the refresh endpoint.

const REFRESH_COOKIE = "gh_refresh"
/** GitHub's default refresh-token lifetime (6 months), used as a fallback. */
const DEFAULT_REFRESH_MAX_AGE = 15_897_600

/** A `Set-Cookie` value that stores the refresh token. */
export function refreshCookie(token: string, maxAgeSeconds?: number): string {
  const maxAge = maxAgeSeconds ?? DEFAULT_REFRESH_MAX_AGE
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

/** A `Set-Cookie` value that immediately clears the refresh token. */
export function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

/** Read the refresh token from the request's Cookie header, or null. */
export function readRefreshCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie")
  if (!cookie) return null
  const match = new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`).exec(cookie)
  return match ? match[1] : null
}
