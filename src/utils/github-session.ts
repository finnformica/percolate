// The live GitHub access-token session, kept outside the XState machine so the
// refresh flow needs no changes to the machine (and its generated typegen).
//
// - `git.ts` reads the current access token from here via `getAccessToken`.
// - `ensureFreshToken` refreshes proactively just before expiry; `withAuthRetry`
//   refreshes reactively on a 401 and retries once.
// - `sessionStatusAtom` drives the bottom-left status ("Sign in soon" / "Signed
//   out"); it is layered over the sync status in sync-status.tsx.
//
// The refresh token itself never lives here — it stays in the HttpOnly cookie
// the worker manages. We only hold the short-lived access token + timestamps.

import { atom, getDefaultStore } from "jotai"
import type { GitHubUser } from "../schema"
import {
  isAccessTokenNearExpiry,
  isAuthError,
  isSessionExpiringSoon,
  refreshAccessToken,
  SessionExpiredError,
} from "./github-token"

export type SessionStatus = "active" | "expiring" | "expired"

/** Session state for the status UI. `expired` = re-auth required; `expiring` =
 * refresh token nearing its hard limit (rare — only after long inactivity). */
export const sessionStatusAtom = atom<SessionStatus>("active")

const store = getDefaultStore()

type Session = {
  token: string
  accessTokenExpiresAt?: number
  refreshTokenExpiresAt?: number
}

let session: Session | null = null
/** Single-flight guard so concurrent syncs don't refresh in parallel. */
let refreshing: Promise<void> | null = null

function recomputeStatus() {
  const expiring = !!session && isSessionExpiringSoon(session.refreshTokenExpiresAt, Date.now())
  store.set(sessionStatusAtom, expiring ? "expiring" : "active")
}

/** Seed (or replace) the session from a signed-in user. Called on sign-in and
 * on reload; clears the `expired` flag since we now have fresh credentials. */
export function seedSession(user: GitHubUser) {
  session = {
    token: user.token,
    accessTokenExpiresAt: user.accessTokenExpiresAt,
    refreshTokenExpiresAt: user.refreshTokenExpiresAt,
  }
  recomputeStatus()
}

/** Forget the session (sign-out). */
export function clearSession() {
  session = null
  store.set(sessionStatusAtom, "active")
}

/** The current access token, for git auth. */
export function getAccessToken(): string | undefined {
  return session?.token
}

function doRefresh(): Promise<void> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const next = await refreshAccessToken()
      session = {
        token: next.token,
        accessTokenExpiresAt: next.accessTokenExpiresAt,
        refreshTokenExpiresAt: next.refreshTokenExpiresAt,
      }
      recomputeStatus()
    } catch (error) {
      // A dead refresh token is terminal — surface "Signed out". Transient
      // (network) failures leave the status alone so a later sync can recover.
      if (error instanceof SessionExpiredError) store.set(sessionStatusAtom, "expired")
      throw error
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Refresh proactively when the access token is within the lead window, so an
 * upcoming git op doesn't 401. No-op without a session or a known expiry. */
export async function ensureFreshToken(): Promise<void> {
  if (!session) return
  if (!isAccessTokenNearExpiry(session.accessTokenExpiresAt, Date.now())) return
  await doRefresh()
}

/** Run a git operation, refreshing once and retrying if it fails with a 401.
 * If the refresh itself fails (revoked/expired token) the error propagates and
 * the status is set to `expired`. */
export async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!session || !isAuthError(error)) throw error
    await doRefresh()
    return await operation()
  }
}
